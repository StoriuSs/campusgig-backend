import { Exclude, Expose, Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

import type {
    TransactionDirection,
    TransactionStatus,
    TransactionType
} from '../../../domain/ports/wallet.repository.port'

const TYPES: TransactionType[] = ['Deposit', 'Payment', 'Earning', 'Refund', 'Withdrawal']
const DIRECTIONS: TransactionDirection[] = ['Incoming', 'Outgoing']
const STATUSES: TransactionStatus[] = ['Completed', 'Pending', 'Rejected']

@Exclude()
export class TransactionWithdrawalInfoDto {
    @Expose() @IsString() bankName!: string
    @Expose() @IsString() bankAccountNumber!: string
    @Expose() @IsString() bankAccountHolder!: string
    @Expose() @IsInt() @Min(0) availableBalanceSnapshot!: number
}

@Exclude()
export class TransactionItemDto {
    @Expose() @IsString() id!: string
    @Expose() @IsIn(TYPES) type!: TransactionType
    @Expose() @IsIn(DIRECTIONS) direction!: TransactionDirection
    @Expose() @IsIn(STATUSES) status!: TransactionStatus
    @Expose() @IsInt() @Min(0) amountVnd!: number
    @Expose() @IsOptional() @IsInt() @Min(0) balanceAfterVnd!: number | null
    @Expose() @IsOptional() @IsString() orderId!: string | null
    @Expose() @IsOptional() @IsString() withdrawalRequestId!: string | null
    @Expose() @IsString() description!: string
    @Expose() @IsString() createdAt!: string

    @Expose()
    @IsOptional()
    @ValidateNested()
    @Type(() => TransactionWithdrawalInfoDto)
    withdrawal!: TransactionWithdrawalInfoDto | null
}
