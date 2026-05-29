import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsString, Min } from 'class-validator'

@Exclude()
export class MarkReadResponseDto {
    @Expose() @IsString() lastReadAt!: string
    @Expose() @IsInt() @Min(0) unreadCleared!: number
}
