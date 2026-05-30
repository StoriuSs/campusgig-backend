import { Exclude, Expose } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

@Exclude()
export class ActionRequiredCountsResponseDto {
    @Expose() @IsInt() @Min(0) asBuyer!: number
    @Expose() @IsInt() @Min(0) asSeller!: number
}
