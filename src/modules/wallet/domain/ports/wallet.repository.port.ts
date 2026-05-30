export const WALLET_REPOSITORY_PORT = 'WALLET_REPOSITORY_PORT'

// Mirrors Prisma enums so application/domain layers never depend on @prisma/client.
export type TransactionType = 'Deposit' | 'Payment' | 'Earning' | 'Refund' | 'Withdrawal'
export type TransactionDirection = 'Incoming' | 'Outgoing'
export type TransactionStatus = 'Completed' | 'Pending' | 'Rejected'
export type WithdrawalStatus = 'Pending' | 'Completed' | 'Rejected'
export type WithdrawalRejectionReason =
    | 'InvalidAccount'
    | 'SuspiciousActivity'
    | 'InsufficientDocumentation'
    | 'PolicyViolation'
    | 'Other'

export type WithdrawalSort = 'newest' | 'oldest' | 'amountDesc' | 'amountAsc'

export interface WalletBalance {
    walletBalance: number
    escrowBalance: number
    pendingWithdrawalBalance: number
    hasBankAccount: boolean
    bankName: string | null
    bankAccountNumber: string | null
    bankAccountHolder: string | null
}

// Withdrawal-specific info attached to Withdrawal-type Transactions so the
// frontend can render the bank account and balance-after without a second fetch.
export interface TransactionWithdrawalInfo {
    bankName: string
    bankAccountNumber: string
    bankAccountHolder: string
    availableBalanceSnapshot: number
}

export interface TransactionItem {
    id: string
    type: TransactionType
    direction: TransactionDirection
    status: TransactionStatus
    amountVnd: number
    balanceAfterVnd: number | null
    orderId: string | null
    withdrawalRequestId: string | null
    description: string
    createdAt: Date
    withdrawal: TransactionWithdrawalInfo | null
}

export interface ListTransactionsResult {
    items: TransactionItem[]
    total: number
    page: number
    pageSize: number
}

// Withdrawal item with the user info needed by the admin list and detail views.
export interface WithdrawalRequestUserInfo {
    id: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
    isEndorsed: boolean
    memberSince: Date
    walletBalance: number
    pendingWithdrawalBalance: number
}

export interface WithdrawalRequestItem {
    id: string
    transactionId: string | null
    user: WithdrawalRequestUserInfo
    amountVnd: number
    bankName: string
    bankAccountNumber: string
    bankAccountHolder: string
    availableBalanceSnapshot: number
    status: WithdrawalStatus
    rejectionReason: WithdrawalRejectionReason | null
    rejectionNote: string | null
    processedByUserId: string | null
    requestedAt: Date
    processedAt: Date | null
}

export interface ListWithdrawalsResult {
    items: WithdrawalRequestItem[]
    total: number
    page: number
    pageSize: number
}

export interface BankAccountInput {
    bankName: string
    bankAccountNumber: string
    bankAccountHolder: string
}

export interface RequestWithdrawalResult {
    balance: WalletBalance
    transaction: TransactionItem
    request: WithdrawalRequestItem
}

export interface DepositResult {
    balance: WalletBalance
    transaction: TransactionItem
}

export interface WalletRepositoryPort {
    // ── Read ───────────────────────────────────────────────────────────────
    getBalance(userId: string): Promise<WalletBalance>
    listTransactions(
        userId: string,
        filters: { type?: TransactionType | 'all'; page: number; pageSize: number }
    ): Promise<ListTransactionsResult>
    listWithdrawalRequests(filters: {
        status: 'pending' | 'completed' | 'rejected'
        sort: WithdrawalSort
        q?: string
        page: number
        pageSize: number
    }): Promise<ListWithdrawalsResult>
    findWithdrawalById(id: string): Promise<WithdrawalRequestItem | null>
    hasPendingWithdrawal(userId: string): Promise<boolean>
    countPending(): Promise<number>
    countProcessedThisMonth(): Promise<number>

    // ── Write (each method wraps multi-table mutations in $transaction) ────
    deposit(userId: string, amountVnd: number): Promise<DepositResult>
    setupBankAccount(userId: string, bank: BankAccountInput): Promise<void>
    requestWithdrawal(userId: string, amountVnd: number): Promise<RequestWithdrawalResult>
    approveWithdrawal(withdrawalId: string, adminId: string): Promise<WithdrawalRequestItem>
    rejectWithdrawal(
        withdrawalId: string,
        adminId: string,
        reason: WithdrawalRejectionReason,
        note: string
    ): Promise<WithdrawalRequestItem>

    // ── Service surface for F09–10 Orders ──────────────────────────────────
    // All three methods accept an optional `tx?: any` Prisma transaction
    // client so callers (the orders module) can wrap the wallet movement +
    // the order state flip in a single atomic block. When `tx` is omitted
    // the method opens its own `$transaction` — the legacy single-call path.
    moveToEscrow(
        userId: string,
        amountVnd: number,
        orderId: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx?: any
    ): Promise<TransactionItem>

    // Splits the escrowed amount 80/20 (or per `platformFeePct`) — the seller's
    // share lands in their `walletBalance` as an Earning Tx, and the
    // platform's share lands in `platformUserId`'s `walletBalance` as an
    // Earning Tx (the platform user IS the destination, so from its POV the
    // fee is also earnings). Integer math: `platformShare = floor(amount *
    // pct / 100); sellerShare = amount - platformShare;` — 1₫ rounding
    // favors the seller (the more generous default for a community platform).
    releaseFromEscrow(
        buyerId: string,
        sellerId: string,
        platformUserId: string,
        amountVnd: number,
        platformFeePct: number,
        orderId: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx?: any
    ): Promise<{ earning: TransactionItem; platformFee: TransactionItem }>

    refundFromEscrow(
        buyerId: string,
        amountVnd: number,
        orderId: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx?: any
    ): Promise<TransactionItem>
}
