import { Exclude, Expose, Type } from 'class-transformer'
import { IsInt, IsOptional, Min, ValidateNested } from 'class-validator'
import { BankAccountDto } from './bank-account.dto'

@Exclude()
export class WithdrawRequestDto {
    @Expose() @IsInt() @Min(50_000) amountVnd!: number

    @Expose()
    @IsOptional()
    @ValidateNested()
    @Type(() => BankAccountDto)
    bankAccount?: BankAccountDto
}
