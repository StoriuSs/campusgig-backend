import { Exclude, Expose } from 'class-transformer'
import { IsString, Length, Matches } from 'class-validator'

@Exclude()
export class BankAccountDto {
    @Expose() @IsString() @Length(2, 100) bankName!: string
    @Expose() @IsString() @Matches(/^[0-9]{6,20}$/) bankAccountNumber!: string
    @Expose() @IsString() @Length(2, 100) bankAccountHolder!: string
}
