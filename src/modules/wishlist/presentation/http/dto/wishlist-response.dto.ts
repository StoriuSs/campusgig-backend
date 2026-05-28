import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

@Exclude()
export class WishlistGigSellerDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    @Expose() @IsBoolean() isEndorsed!: boolean
}

@Exclude()
export class WishlistGigItemDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() title!: string
    @Expose() @IsInt() priceVnd!: number
    @Expose() @IsInt() @Min(1) deliveryDays!: number
    @Expose() @IsOptional() @IsString() coverImageUrl!: string | null
    @Expose() @IsString() savedAt!: string
    @Expose() @ValidateNested() @Type(() => WishlistGigSellerDto) seller!: WishlistGigSellerDto
}

@Exclude()
export class WishlistResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => WishlistGigItemDto)
    items!: WishlistGigItemDto[]

    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
}
