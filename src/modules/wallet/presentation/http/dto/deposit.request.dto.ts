import { Exclude, Expose } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

@Exclude()
export class DepositRequestDto {
    @Expose() @IsInt() @Min(1) amountVnd!: number
}
