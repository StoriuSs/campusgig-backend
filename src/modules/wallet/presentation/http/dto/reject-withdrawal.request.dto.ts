import { Exclude, Expose } from 'class-transformer'
import { IsIn, IsString, Length } from 'class-validator'
import type { WithdrawalRejectionReason } from '../../../domain/ports/wallet.repository.port'

const REASONS: WithdrawalRejectionReason[] = [
    'InvalidAccount',
    'SuspiciousActivity',
    'InsufficientDocumentation',
    'PolicyViolation',
    'Other'
]

@Exclude()
export class RejectWithdrawalRequestDto {
    @Expose() @IsIn(REASONS) reason!: WithdrawalRejectionReason
    @Expose() @IsString() @Length(1, 500) note!: string
}
