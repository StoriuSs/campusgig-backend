import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator'

@Exclude()
export class DeliveryFileResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class DeliveryResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() orderId!: string
    @Expose() @IsInt() @Min(1) version!: number
    @Expose() @IsString() note!: string
    @Expose() @IsString() deliveredAt!: string

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DeliveryFileResponseDto)
    files!: DeliveryFileResponseDto[]
}
