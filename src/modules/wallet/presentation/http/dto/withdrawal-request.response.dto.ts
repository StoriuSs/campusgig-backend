import { Exclude, Expose } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'

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
export class WithdrawalRequestDto {
    @Expose() @IsString() id!: string
    @Expose() @IsInt() @Min(0) amountVnd!: number
    @Expose() @IsIn(STATUSES) status!: WithdrawalStatus
    @Expose() @IsOptional() @IsIn(REASONS) rejectionReason!: WithdrawalRejectionReason | null
    @Expose() @IsOptional() @IsString() rejectionNote!: string | null
    @Expose() @IsString() requestedAt!: string
    @Expose() @IsOptional() @IsString() processedAt!: string | null
}
