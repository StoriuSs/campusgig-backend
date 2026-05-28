import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

@Exclude()
export class PublicGigSellerDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    @Expose() @IsBoolean() isEndorsed!: boolean
}

@Exclude()
export class PublicGigSummaryDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() title!: string
    @Expose() @IsInt() priceVnd!: number
    @Expose() @IsInt() @Min(1) deliveryDays!: number
    @Expose() @IsOptional() @IsString() coverImageUrl!: string | null
    @Expose() @IsOptional() @IsNumber() avgRating!: number | null
    @Expose() @IsInt() @Min(0) reviewCount!: number
    @Expose() @IsBoolean() isSaved!: boolean
    @Expose() @ValidateNested() @Type(() => PublicGigSellerDto) seller!: PublicGigSellerDto
}

@Exclude()
export class BrowseGigsResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PublicGigSummaryDto)
    items!: PublicGigSummaryDto[]

    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
}

@Exclude()
export class PublicGigImageDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() url!: string
    @Expose() @IsInt() width!: number
    @Expose() @IsInt() height!: number
}

@Exclude()
export class PublicGigBulletDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() text!: string
}

@Exclude()
export class PublicGigFaqDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() question!: string
    @Expose() @IsString() answer!: string
}

@Exclude()
export class PublicGigDetailSellerDto extends PublicGigSellerDto {
    @Expose() @IsOptional() @IsString() bio!: string | null
    @Expose() @IsOptional() @IsString() roleLine!: string | null
    @Expose() @IsOptional() @IsString() location!: string | null
    @Expose() @IsOptional() @IsString() languages!: string | null
    @Expose() @IsArray() @IsString({ each: true }) skills!: string[]
    @Expose() @IsString() joinedAt!: string
    @Expose() @IsInt() @Min(0) gigCount!: number
    @Expose() @IsOptional() @IsNumber() avgRating!: number | null
    @Expose() @IsInt() @Min(0) reviewCount!: number
    @Expose() @IsInt() @Min(0) completedOrderCount!: number
}

@Exclude()
export class PublicGigDetailDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() title!: string
    @Expose() @IsString() description!: string
    @Expose() @IsInt() priceVnd!: number
    @Expose() @IsInt() @Min(1) deliveryDays!: number
    @Expose() @IsString() categoryId!: string
    @Expose() @IsString() categoryName!: string
    @Expose() @IsOptional() @IsNumber() avgRating!: number | null
    @Expose() @IsInt() @Min(0) reviewCount!: number
    @Expose() @IsInt() @Min(0) completedOrderCount!: number
    @Expose() @IsBoolean() isSaved!: boolean

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PublicGigImageDto)
    images!: PublicGigImageDto[]

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PublicGigBulletDto)
    bullets!: PublicGigBulletDto[]

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PublicGigFaqDto)
    faqs!: PublicGigFaqDto[]

    @Expose() @ValidateNested() @Type(() => PublicGigDetailSellerDto) seller!: PublicGigDetailSellerDto

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PublicGigSummaryDto)
    similarGigs!: PublicGigSummaryDto[]

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PublicGigSummaryDto)
    otherBySellerGigs!: PublicGigSummaryDto[]
}
