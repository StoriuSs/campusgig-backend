import { Exclude, Expose } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

@Exclude()
export class UnreadCountResponseDto {
    @Expose() @IsInt() @Min(0) count!: number
}
