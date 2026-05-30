import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

@Exclude()
export class GigSnapshotResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() title!: string
    @Expose() @IsInt() @Min(0) priceVnd!: number
    @Expose() @IsInt() @Min(1) deliveryDays!: number
    @Expose() @IsOptional() @IsString() coverUrl!: string | null
}
