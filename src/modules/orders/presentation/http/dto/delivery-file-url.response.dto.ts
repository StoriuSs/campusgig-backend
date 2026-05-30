import { Exclude, Expose } from 'class-transformer'
import { IsString } from 'class-validator'

@Exclude()
export class DeliveryFileUrlResponseDto {
    @Expose() @IsString() url!: string
    @Expose() @IsString() name!: string
}
