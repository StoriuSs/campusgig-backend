import { Exclude, Expose } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

@Exclude()
export class WalletBalanceDto {
    @Expose() @IsInt() @Min(0) walletBalance!: number
    @Expose() @IsInt() @Min(0) escrowBalance!: number
    @Expose() @IsInt() @Min(0) pendingWithdrawalBalance!: number
    @Expose() @IsBoolean() hasBankAccount!: boolean
    @Expose() @IsOptional() @IsString() bankName!: string | null
    @Expose() @IsOptional() @IsString() bankAccountNumberMasked!: string | null
    @Expose() @IsOptional() @IsString() bankAccountHolder!: string | null
}
