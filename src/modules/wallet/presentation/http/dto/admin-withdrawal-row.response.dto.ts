import { Exclude, Expose, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import type { WithdrawalRejectionReason, WithdrawalStatus } from '../../../domain/ports/wallet.repository.port'

const STATUSES: WithdrawalStatus[] = ['Pending', 'Completed', 'Rejected']
const REASONS: WithdrawalRejectionReason[] = [
    'InvalidAccount',
    'SuspiciousActivity',
    'InsufficientDocumentation',
    'PolicyViolation',
    'Other'
]

@Exclude()
export class AdminWithdrawalUserDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    @Expose() @IsBoolean() isEndorsed!: boolean
    @Expose() @IsString() memberSince!: string
    @Expose() @IsInt() @Min(0) walletBalance!: number
    @Expose() @IsInt() @Min(0) pendingWithdrawalBalance!: number
}

@Exclude()
export class AdminWithdrawalRowDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() transactionId!: string | null
    // user info displayed in the table + modal
    @Expose() @ValidateNested() @Type(() => AdminWithdrawalUserDto) user!: AdminWithdrawalUserDto

    @Expose() @IsInt() @Min(0) amountVnd!: number
    @Expose() @IsString() bankName!: string
    @Expose() @IsString() bankAccountNumber!: string
    @Expose() @IsString() bankAccountHolder!: string
    @Expose() @IsInt() @Min(0) availableBalanceSnapshot!: number
    @Expose() @IsIn(STATUSES) status!: WithdrawalStatus
    @Expose() @IsOptional() @IsIn(REASONS) rejectionReason!: WithdrawalRejectionReason | null
    @Expose() @IsOptional() @IsString() rejectionNote!: string | null
    @Expose() @IsString() requestedAt!: string
    @Expose() @IsOptional() @IsString() processedAt!: string | null
}
