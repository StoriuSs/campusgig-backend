import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import { formatOrderCode } from '@/shared/utils'
import {
    BankAccountInput,
    DepositResult,
    ListTransactionsResult,
    ListWithdrawalsResult,
    RequestWithdrawalResult,
    TransactionItem,
    TransactionType,
    WalletBalance,
    WalletRepositoryPort,
    WithdrawalRejectionReason,
    WithdrawalRequestItem,
    WithdrawalRequestUserInfo,
    WithdrawalSort
} from '../../domain/ports/wallet.repository.port'

const REASON_LABEL: Record<WithdrawalRejectionReason, string> = {
    InvalidAccount: 'Invalid account',
    SuspiciousActivity: 'Suspicious activity',
    InsufficientDocumentation: 'Insufficient documentation',
    PolicyViolation: 'Policy violation',
    Other: 'Other'
}

function last4(accountNumber: string): string {
    return accountNumber.slice(-4)
}

@Injectable()
export class PrismaWalletRepository implements WalletRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toBalance(user: any): WalletBalance {
        return {
            walletBalance: user.walletBalance,
            escrowBalance: user.escrowBalance,
            pendingWithdrawalBalance: user.pendingWithdrawalBalance,
            hasBankAccount: user.bankName != null && user.bankAccountNumber != null,
            bankName: user.bankName ?? null,
            bankAccountNumber: user.bankAccountNumber ?? null,
            bankAccountHolder: user.bankAccountHolder ?? null
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toTransaction(tx: any): TransactionItem {
        const withdrawal = tx.withdrawalRequest
            ? {
                  bankName: tx.withdrawalRequest.bankNameSnapshot,
                  bankAccountNumber: tx.withdrawalRequest.bankAccountNumberSnapshot,
                  bankAccountHolder: tx.withdrawalRequest.bankAccountHolderSnapshot,
                  availableBalanceSnapshot: tx.withdrawalRequest.availableBalanceSnapshot
              }
            : null
        // Description is stored with raw orderId; patch to CG-XXXX at read time so pre-fix rows also display correctly.
        const description: string = tx.order
            ? (tx.description as string).replace(tx.orderId, formatOrderCode(tx.order.number))
            : tx.description
        return {
            id: tx.id,
            type: tx.type,
            direction: tx.direction,
            status: tx.status,
            amountVnd: tx.amountVnd,
            balanceAfterVnd: tx.balanceAfterVnd ?? null,
            orderId: tx.orderId ?? null,
            withdrawalRequestId: tx.withdrawalRequestId ?? null,
            description,
            createdAt: tx.createdAt,
            withdrawal
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toRequest(req: any, user: any): WithdrawalRequestItem {
        const userInfo: WithdrawalRequestUserInfo = {
            id: user.id,
            username: user.username ?? null,
            displayName: user.displayName ?? null,
            avatarKey: user.avatarUrl ?? null,
            isEndorsed: user.endorsedAt != null,
            memberSince: user.createdAt,
            walletBalance: user.walletBalance,
            pendingWithdrawalBalance: user.pendingWithdrawalBalance
        }
        return {
            id: req.id,
            transactionId: req.transaction?.id ?? null,
            user: userInfo,
            amountVnd: req.amountVnd,
            bankName: req.bankNameSnapshot,
            bankAccountNumber: req.bankAccountNumberSnapshot,
            bankAccountHolder: req.bankAccountHolderSnapshot,
            availableBalanceSnapshot: req.availableBalanceSnapshot,
            status: req.status,
            rejectionReason: req.rejectionReason ?? null,
            rejectionNote: req.rejectionNote ?? null,
            processedByUserId: req.processedByUserId ?? null,
            requestedAt: req.requestedAt,
            processedAt: req.processedAt ?? null
        }
    }

    async getBalance(userId: string): Promise<WalletBalance> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                walletBalance: true,
                escrowBalance: true,
                pendingWithdrawalBalance: true,
                bankName: true,
                bankAccountNumber: true,
                bankAccountHolder: true
            }
        })
        if (!user) throw new BadRequestException('User not found')
        return this.toBalance(user)
    }

    async listTransactions(
        userId: string,
        filters: { type?: TransactionType | 'all'; page: number; pageSize: number }
    ): Promise<ListTransactionsResult> {
        const { type, page, pageSize } = filters
        const skip = (page - 1) * pageSize

        const where: { userId: string; type?: TransactionType } = { userId }
        if (type && type !== 'all') where.type = type

        const [items, total] = await this.prisma.$transaction([
            this.prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                include: {
                    withdrawalRequest: {
                        select: {
                            bankNameSnapshot: true,
                            bankAccountNumberSnapshot: true,
                            bankAccountHolderSnapshot: true,
                            availableBalanceSnapshot: true
                        }
                    }
                }
            }),
            this.prisma.transaction.count({ where })
        ])

        // No FK on Transaction.orderId, so resolve order codes in a follow-up query.
        const orderIds = Array.from(new Set(items.map((t) => t.orderId).filter((id): id is string => !!id)))
        const orderNumbers: Record<string, number> = {}
        if (orderIds.length > 0) {
            const orders = await this.prisma.order.findMany({
                where: { id: { in: orderIds } },
                select: { id: true, number: true }
            })
            for (const o of orders) orderNumbers[o.id] = o.number
        }

        return {
            items: items.map((t) =>
                this.toTransaction({
                    ...t,
                    order:
                        t.orderId && orderNumbers[t.orderId] !== undefined ? { number: orderNumbers[t.orderId] } : null
                })
            ),
            total,
            page,
            pageSize
        }
    }

    async listWithdrawalRequests(filters: {
        status: 'pending' | 'completed' | 'rejected'
        sort: WithdrawalSort
        q?: string
        page: number
        pageSize: number
    }): Promise<ListWithdrawalsResult> {
        const { status, sort, q, page, pageSize } = filters
        const skip = (page - 1) * pageSize

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {}
        if (status === 'pending') where.status = 'Pending'
        else if (status === 'completed') where.status = 'Completed'
        else where.status = 'Rejected'
        if (q && q.trim()) {
            const term = q.trim()
            where.OR = [
                { user: { displayName: { contains: term, mode: 'insensitive' } } },
                { user: { username: { contains: term, mode: 'insensitive' } } },
                { transaction: { id: { contains: term, mode: 'insensitive' } } }
            ]
        }

        const orderBy =
            sort === 'oldest'
                ? [{ requestedAt: 'asc' as const }]
                : sort === 'amountDesc'
                  ? [{ amountVnd: 'desc' as const }]
                  : sort === 'amountAsc'
                    ? [{ amountVnd: 'asc' as const }]
                    : [{ requestedAt: 'desc' as const }]

        const [rows, total] = await this.prisma.$transaction([
            this.prisma.withdrawalRequest.findMany({
                where,
                orderBy,
                skip,
                take: pageSize,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true,
                            endorsedAt: true,
                            createdAt: true,
                            walletBalance: true,
                            pendingWithdrawalBalance: true
                        }
                    },
                    transaction: { select: { id: true } }
                }
            }),
            this.prisma.withdrawalRequest.count({ where })
        ])

        return {
            items: rows.map((r) => this.toRequest(r, r.user)),
            total,
            page,
            pageSize
        }
    }

    async findWithdrawalById(id: string): Promise<WithdrawalRequestItem | null> {
        const row = await this.prisma.withdrawalRequest.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                        endorsedAt: true,
                        createdAt: true,
                        walletBalance: true,
                        pendingWithdrawalBalance: true
                    }
                },
                transaction: { select: { id: true } }
            }
        })
        if (!row) return null
        return this.toRequest(row, row.user)
    }

    async hasPendingWithdrawal(userId: string): Promise<boolean> {
        const count = await this.prisma.withdrawalRequest.count({
            where: { userId, status: 'Pending' }
        })
        return count > 0
    }

    async countPending(): Promise<number> {
        return this.prisma.withdrawalRequest.count({ where: { status: 'Pending' } })
    }

    async countProcessedThisMonth(): Promise<number> {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        return this.prisma.withdrawalRequest.count({
            where: {
                status: { in: ['Completed', 'Rejected'] },
                processedAt: { gte: startOfMonth }
            }
        })
    }

    async deposit(userId: string, amountVnd: number): Promise<DepositResult> {
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: userId },
                data: { walletBalance: { increment: amountVnd } },
                select: {
                    walletBalance: true,
                    escrowBalance: true,
                    pendingWithdrawalBalance: true,
                    bankName: true,
                    bankAccountNumber: true,
                    bankAccountHolder: true
                }
            })
            const transaction = await tx.transaction.create({
                data: {
                    userId,
                    type: 'Deposit',
                    direction: 'Incoming',
                    status: 'Completed',
                    amountVnd,
                    balanceAfterVnd: user.walletBalance,
                    description: 'Deposited to wallet'
                }
            })
            return {
                balance: this.toBalance(user),
                transaction: this.toTransaction(transaction)
            }
        })
    }

    async setupBankAccount(userId: string, bank: BankAccountInput): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                bankName: bank.bankName,
                bankAccountNumber: bank.bankAccountNumber,
                bankAccountHolder: bank.bankAccountHolder
            }
        })
    }

    async requestWithdrawal(userId: string, amountVnd: number): Promise<RequestWithdrawalResult> {
        return this.prisma.$transaction(async (tx) => {
            // Single-row decrement/increment is atomic. If another concurrent
            // withdrawal already drained the balance, the resulting walletBalance
            // would go negative — we check after the update.
            const user = await tx.user.update({
                where: { id: userId },
                data: {
                    walletBalance: { decrement: amountVnd },
                    pendingWithdrawalBalance: { increment: amountVnd }
                },
                select: {
                    id: true,
                    walletBalance: true,
                    escrowBalance: true,
                    pendingWithdrawalBalance: true,
                    bankName: true,
                    bankAccountNumber: true,
                    bankAccountHolder: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    endorsedAt: true,
                    createdAt: true
                }
            })

            if (user.walletBalance < 0) {
                // Concurrent withdrawal won. Force rollback by throwing.
                throw new BadRequestException('Insufficient balance')
            }

            if (!user.bankName || !user.bankAccountNumber || !user.bankAccountHolder) {
                throw new BadRequestException('Bank account is required')
            }

            const request = await tx.withdrawalRequest.create({
                data: {
                    userId,
                    amountVnd,
                    bankNameSnapshot: user.bankName,
                    bankAccountNumberSnapshot: user.bankAccountNumber,
                    bankAccountHolderSnapshot: user.bankAccountHolder,
                    // Pre-decrement available = current walletBalance + this amount.
                    availableBalanceSnapshot: user.walletBalance + amountVnd,
                    status: 'Pending'
                }
            })

            const transaction = await tx.transaction.create({
                data: {
                    userId,
                    type: 'Withdrawal',
                    direction: 'Outgoing',
                    status: 'Pending',
                    amountVnd,
                    balanceAfterVnd: user.walletBalance,
                    withdrawalRequestId: request.id,
                    description: `To Bank Account · ····${last4(user.bankAccountNumber)} · awaiting admin approval`
                }
            })

            return {
                balance: this.toBalance(user),
                transaction: this.toTransaction(transaction),
                request: this.toRequest(request, user)
            }
        })
    }

    async approveWithdrawal(withdrawalId: string, adminId: string): Promise<WithdrawalRequestItem> {
        return this.prisma.$transaction(async (tx) => {
            const request = await tx.withdrawalRequest.findUnique({
                where: { id: withdrawalId }
            })
            if (!request) throw new BadRequestException('Withdrawal not found')

            await tx.user.update({
                where: { id: request.userId },
                data: { pendingWithdrawalBalance: { decrement: request.amountVnd } }
            })

            const updated = await tx.withdrawalRequest.update({
                where: { id: withdrawalId },
                data: {
                    status: 'Completed',
                    processedAt: new Date(),
                    processedByUserId: adminId
                }
            })

            await tx.transaction.updateMany({
                where: { withdrawalRequestId: withdrawalId },
                data: {
                    status: 'Completed',
                    description: `To Bank Account · ····${last4(request.bankAccountNumberSnapshot)}`
                }
            })

            const user = await tx.user.findUnique({
                where: { id: request.userId },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    endorsedAt: true,
                    createdAt: true,
                    walletBalance: true,
                    pendingWithdrawalBalance: true
                }
            })

            return this.toRequest(updated, user!)
        })
    }

    async rejectWithdrawal(
        withdrawalId: string,
        adminId: string,
        reason: WithdrawalRejectionReason,
        note: string
    ): Promise<WithdrawalRequestItem> {
        return this.prisma.$transaction(async (tx) => {
            const request = await tx.withdrawalRequest.findUnique({
                where: { id: withdrawalId }
            })
            if (!request) throw new BadRequestException('Withdrawal not found')

            // Restore the held amount back to walletBalance.
            const restoredUser = await tx.user.update({
                where: { id: request.userId },
                data: {
                    pendingWithdrawalBalance: { decrement: request.amountVnd },
                    walletBalance: { increment: request.amountVnd }
                },
                select: { walletBalance: true }
            })

            const updated = await tx.withdrawalRequest.update({
                where: { id: withdrawalId },
                data: {
                    status: 'Rejected',
                    rejectionReason: reason,
                    rejectionNote: note,
                    processedAt: new Date(),
                    processedByUserId: adminId
                }
            })

            // Overwrite balanceAfterVnd to reflect the rejection outcome
            // (money was restored — balance is back to its pre-request value).
            await tx.transaction.updateMany({
                where: { withdrawalRequestId: withdrawalId },
                data: {
                    status: 'Rejected',
                    balanceAfterVnd: restoredUser.walletBalance,
                    description: `Withdrawal rejected — ${REASON_LABEL[reason]}\n${note}`
                }
            })

            const user = await tx.user.findUnique({
                where: { id: request.userId },
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    endorsedAt: true,
                    createdAt: true,
                    walletBalance: true,
                    pendingWithdrawalBalance: true
                }
            })

            return this.toRequest(updated, user!)
        })
    }

    // Optional `tx` lets callers wrap wallet moves + order state changes in one atomic block.

    async moveToEscrow(
        userId: string,
        amountVnd: number,
        orderId: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx?: any
    ): Promise<TransactionItem> {
        const run = async (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            client: any
        ): Promise<TransactionItem> => {
            const user = await client.user.update({
                where: { id: userId },
                data: {
                    walletBalance: { decrement: amountVnd },
                    escrowBalance: { increment: amountVnd }
                },
                select: { walletBalance: true }
            })
            if (user.walletBalance < 0) {
                throw new BadRequestException('Insufficient balance')
            }
            const transaction = await client.transaction.create({
                data: {
                    userId,
                    type: 'Payment',
                    direction: 'Outgoing',
                    status: 'Completed',
                    amountVnd,
                    balanceAfterVnd: user.walletBalance,
                    orderId,
                    description: `Held in escrow for order ${orderId}`
                }
            })
            return this.toTransaction(transaction)
        }
        return tx ? run(tx) : this.prisma.$transaction(run)
    }

    async releaseFromEscrow(
        buyerId: string,
        sellerId: string,
        platformUserId: string,
        amountVnd: number,
        platformFeePct: number,
        orderId: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx?: any
    ): Promise<{ earning: TransactionItem; platformFee: TransactionItem }> {
        const run = async (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            client: any
        ): Promise<{ earning: TransactionItem; platformFee: TransactionItem }> => {
            // Integer split — platformShare floored, sellerShare gets the
            // remainder. 1₫ rounding favors the seller, which is the more
            // generous default for a community marketplace.
            const platformShare = Math.floor((amountVnd * platformFeePct) / 100)
            const sellerShare = amountVnd - platformShare

            await client.user.update({
                where: { id: buyerId },
                data: { escrowBalance: { decrement: amountVnd } }
            })
            const sellerAfter = await client.user.update({
                where: { id: sellerId },
                data: { walletBalance: { increment: sellerShare } },
                select: { walletBalance: true }
            })
            const platformAfter = await client.user.update({
                where: { id: platformUserId },
                data: { walletBalance: { increment: platformShare } },
                select: { walletBalance: true }
            })

            const earning = await client.transaction.create({
                data: {
                    userId: sellerId,
                    type: 'Earning',
                    direction: 'Incoming',
                    status: 'Completed',
                    amountVnd: sellerShare,
                    balanceAfterVnd: sellerAfter.walletBalance,
                    orderId,
                    description: `Earned from order ${orderId}`
                }
            })
            // Platform fee is booked as Earning on the platform user's wallet — no separate TransactionType needed.
            const platformFee = await client.transaction.create({
                data: {
                    userId: platformUserId,
                    type: 'Earning',
                    direction: 'Incoming',
                    status: 'Completed',
                    amountVnd: platformShare,
                    balanceAfterVnd: platformAfter.walletBalance,
                    orderId,
                    description: `Platform fee from order ${orderId}`
                }
            })

            return {
                earning: this.toTransaction(earning),
                platformFee: this.toTransaction(platformFee)
            }
        }
        return tx ? run(tx) : this.prisma.$transaction(run)
    }

    async refundFromEscrow(
        buyerId: string,
        amountVnd: number,
        orderId: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx?: any
    ): Promise<TransactionItem> {
        const run = async (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            client: any
        ): Promise<TransactionItem> => {
            const buyerAfter = await client.user.update({
                where: { id: buyerId },
                data: {
                    escrowBalance: { decrement: amountVnd },
                    walletBalance: { increment: amountVnd }
                },
                select: { walletBalance: true }
            })
            const transaction = await client.transaction.create({
                data: {
                    userId: buyerId,
                    type: 'Refund',
                    direction: 'Incoming',
                    status: 'Completed',
                    amountVnd,
                    balanceAfterVnd: buyerAfter.walletBalance,
                    orderId,
                    description: `Refunded from order ${orderId}`
                }
            })
            return this.toTransaction(transaction)
        }
        return tx ? run(tx) : this.prisma.$transaction(run)
    }
}
