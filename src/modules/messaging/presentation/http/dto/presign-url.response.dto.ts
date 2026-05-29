import { Exclude, Expose } from 'class-transformer'
import { IsString } from 'class-validator'

@Exclude()
export class PresignUrlResponseDto {
    @Expose() @IsString() url!: string
    @Expose() @IsString() expiresAt!: string
}
