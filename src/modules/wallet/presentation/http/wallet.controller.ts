import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Put, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '@/shared/infrastructure'
import { Idempotent } from '@/shared/presentation/decorators'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import {
    DepositFundsCommand,
    GetWalletQuery,
    ListTransactionsQuery,
    RequestWithdrawalCommand,
    SetupBankAccountCommand
} from '../../application'
import type {
    DepositResult,
    ListTransactionsResult,
    RequestWithdrawalResult,
    TransactionItem,
    TransactionType,
    WalletBalance
} from '../../domain/ports/wallet.repository.port'
import {
    BankAccountDto,
    DepositRequestDto,
    DepositResponseDto,
    ListTransactionsResponseDto,
    TransactionItemDto,
    WalletBalanceDto,
    WithdrawalRequestDto,
    WithdrawRequestDto,
    WithdrawResponseDto
} from './dto'

const WALLET_BALANCE_TTL_S = 30

function maskAccountNumber(num: string | null): string | null {
    if (!num) return null
    return `····${num.slice(-4)}`
}

function toBalanceDto(balance: WalletBalance): WalletBalanceDto {
    return validateAndTransform(WalletBalanceDto, {
        walletBalance: balance.walletBalance,
        escrowBalance: balance.escrowBalance,
        pendingWithdrawalBalance: balance.pendingWithdrawalBalance,
        hasBankAccount: balance.hasBankAccount,
        bankName: balance.bankName,
        bankAccountNumberMasked: maskAccountNumber(balance.bankAccountNumber),
        bankAccountHolder: balance.bankAccountHolder
    })
}

function toTransactionDto(t: TransactionItem): TransactionItemDto {
    return validateAndTransform(TransactionItemDto, {
        id: t.id,
        type: t.type,
        direction: t.direction,
        status: t.status,
        amountVnd: t.amountVnd,
        balanceAfterVnd: t.balanceAfterVnd,
        orderId: t.orderId,
        withdrawalRequestId: t.withdrawalRequestId,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
        withdrawal: t.withdrawal
            ? {
                  bankName: t.withdrawal.bankName,
                  bankAccountNumber: t.withdrawal.bankAccountNumber,
                  bankAccountHolder: t.withdrawal.bankAccountHolder,
                  availableBalanceSnapshot: t.withdrawal.availableBalanceSnapshot
              }
            : null
    })
}

@ApiTags('Wallet')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'wallet', version: '1' })
export class WalletController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get my wallet balance + bank account' })
    @ApiResponse({ status: 200, type: WalletBalanceDto })
    async getWallet(@CurrentUser() user: AuthenticatedKeycloakUser): Promise<ServiceResponse<WalletBalanceDto>> {
        const userId = user.local.dbId
        const cacheKey = `wallet:${userId}`

        const cached = await this.cache.get<WalletBalanceDto>(cacheKey)
        if (cached) {
            return createResponse(
                RESPONSE_CODES.WALLET_FETCH_SUCCESS,
                RESPONSE_TYPES.WALLET_FETCH,
                MESSAGES.WALLET.FETCHED,
                cached
            )
        }

        const balance: WalletBalance = await this.queryBus.execute(new GetWalletQuery(userId))
        const dto = toBalanceDto(balance)
        await this.cache.set(cacheKey, dto, WALLET_BALANCE_TTL_S)

        return createResponse(
            RESPONSE_CODES.WALLET_FETCH_SUCCESS,
            RESPONSE_TYPES.WALLET_FETCH,
            MESSAGES.WALLET.FETCHED,
            dto
        )
    }

    @Get('transactions')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List my transactions (paginated, optional type filter)' })
    @ApiQuery({
        name: 'type',
        required: false,
        enum: ['all', 'Deposit', 'Payment', 'Earning', 'Refund', 'Withdrawal']
    })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiResponse({ status: 200, type: ListTransactionsResponseDto })
    async listTransactions(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Query('type') typeParam?: string,
        @Query('page') pageParam?: string,
        @Query('pageSize') pageSizeParam?: string
    ): Promise<ServiceResponse<ListTransactionsResponseDto>> {
        const validTypes: (TransactionType | 'all')[] = ['all', 'Deposit', 'Payment', 'Earning', 'Refund', 'Withdrawal']
        const typeFilter = (validTypes as string[]).includes(typeParam ?? 'all')
            ? ((typeParam ?? 'all') as TransactionType | 'all')
            : 'all'
        const page = Number.parseInt(pageParam ?? '1', 10) || 1
        const pageSize = Math.min(Number.parseInt(pageSizeParam ?? '10', 10) || 10, 50)

        const result: ListTransactionsResult = await this.queryBus.execute(
            new ListTransactionsQuery(user.local.dbId, typeFilter, page, pageSize)
        )

        const dto = validateAndTransform(ListTransactionsResponseDto, {
            items: result.items.map((t) => toTransactionDto(t)),
            total: result.total,
            page: result.page,
            pageSize: result.pageSize
        })

        return createResponse(
            RESPONSE_CODES.WALLET_TRANSACTIONS_FETCH_SUCCESS,
            RESPONSE_TYPES.WALLET_TRANSACTIONS_FETCH,
            MESSAGES.WALLET.TRANSACTIONS_FETCHED,
            dto
        )
    }

    @Post('deposit')
    @HttpCode(HttpStatus.OK)
    @Idempotent('5m')
    @ApiOperation({ summary: 'Deposit funds (instant, simulated)' })
    @ApiResponse({ status: 200, type: DepositResponseDto })
    async deposit(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Body() dto: DepositRequestDto
    ): Promise<ServiceResponse<DepositResponseDto>> {
        const result: DepositResult = await this.commandBus.execute(
            new DepositFundsCommand(user.local.dbId, dto.amountVnd)
        )
        const response = validateAndTransform(DepositResponseDto, {
            balance: toBalanceDto(result.balance),
            transaction: toTransactionDto(result.transaction)
        })
        return createResponse(
            RESPONSE_CODES.WALLET_DEPOSIT_SUCCESS,
            RESPONSE_TYPES.WALLET_DEPOSIT,
            MESSAGES.WALLET.DEPOSITED,
            response
        )
    }

    @Post('withdraw')
    @HttpCode(HttpStatus.OK)
    @Idempotent('5m')
    @ApiOperation({ summary: 'Request a withdrawal (admin processes within 24h)' })
    @ApiResponse({ status: 200, type: WithdrawResponseDto })
    async withdraw(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Body() dto: WithdrawRequestDto
    ): Promise<ServiceResponse<WithdrawResponseDto>> {
        const result: RequestWithdrawalResult = await this.commandBus.execute(
            new RequestWithdrawalCommand(user.local.dbId, dto.amountVnd, dto.bankAccount)
        )

        const requestDto = validateAndTransform(WithdrawalRequestDto, {
            id: result.request.id,
            amountVnd: result.request.amountVnd,
            status: result.request.status,
            rejectionReason: result.request.rejectionReason,
            rejectionNote: result.request.rejectionNote,
            requestedAt: result.request.requestedAt.toISOString(),
            processedAt: result.request.processedAt ? result.request.processedAt.toISOString() : null
        })

        const response = validateAndTransform(WithdrawResponseDto, {
            balance: toBalanceDto(result.balance),
            request: requestDto
        })

        return createResponse(
            RESPONSE_CODES.WALLET_WITHDRAW_SUCCESS,
            RESPONSE_TYPES.WALLET_WITHDRAW,
            MESSAGES.WALLET.WITHDRAW_REQUESTED,
            response
        )
    }

    @Put('bank-account')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Set or update my bank account (blocked while withdrawal pending)' })
    @ApiResponse({ status: 200, type: WalletBalanceDto })
    async updateBankAccount(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Body() dto: BankAccountDto
    ): Promise<ServiceResponse<WalletBalanceDto>> {
        await this.commandBus.execute(
            new SetupBankAccountCommand(user.local.dbId, {
                bankName: dto.bankName,
                bankAccountNumber: dto.bankAccountNumber,
                bankAccountHolder: dto.bankAccountHolder
            })
        )

        // Invalidate cache so the next GET reflects the new bank account.
        await this.cache.del(`wallet:${user.local.dbId}`)

        const balance: WalletBalance = await this.queryBus.execute(new GetWalletQuery(user.local.dbId))

        return createResponse(
            RESPONSE_CODES.WALLET_BANK_ACCOUNT_UPDATE_SUCCESS,
            RESPONSE_TYPES.WALLET_BANK_ACCOUNT_UPDATE,
            MESSAGES.WALLET.BANK_ACCOUNT_UPDATED,
            toBalanceDto(balance)
        )
    }
}
