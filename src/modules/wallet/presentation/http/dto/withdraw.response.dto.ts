import { Exclude, Expose, Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import { WalletBalanceDto } from './wallet-balance.response.dto'
import { WithdrawalRequestDto } from './withdrawal-request.response.dto'

@Exclude()
export class WithdrawResponseDto {
    @Expose() @ValidateNested() @Type(() => WalletBalanceDto) balance!: WalletBalanceDto
    @Expose() @ValidateNested() @Type(() => WithdrawalRequestDto) request!: WithdrawalRequestDto
}
