import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsString, Min } from 'class-validator'

@Exclude()
export class StagedDeliveryFileResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
    @Expose() @IsString() createdAt!: string
}
