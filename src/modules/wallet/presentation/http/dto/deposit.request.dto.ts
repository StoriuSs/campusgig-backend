import { Exclude, Expose } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

// Upper bound keeps a single deposit from inflating the (v1, DB-only) wallet
// toward Int-column overflow and nonsense escrow math. 100M VND ≫ any gig price.
const MAX_DEPOSIT_VND = 100_000_000

@Exclude()
export class DepositRequestDto {
    @Expose() @IsInt() @Min(1) @Max(MAX_DEPOSIT_VND) amountVnd!: number
}
