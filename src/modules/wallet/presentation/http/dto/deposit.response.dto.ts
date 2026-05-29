import { Exclude, Expose, Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import { WalletBalanceDto } from './wallet-balance.response.dto'
import { TransactionItemDto } from './transaction-item.response.dto'

@Exclude()
export class DepositResponseDto {
    @Expose() @ValidateNested() @Type(() => WalletBalanceDto) balance!: WalletBalanceDto
    @Expose() @ValidateNested() @Type(() => TransactionItemDto) transaction!: TransactionItemDto
}
