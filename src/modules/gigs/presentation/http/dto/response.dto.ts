import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

@Exclude()
export class GigImageDto {
    @Expose() @IsString() id!: string
    @Expose() @ApiProperty({ description: 'Presigned S3 GET URL (1h TTL)' }) @IsString() url!: string
    @Expose() @IsInt() @Min(1) width!: number
    @Expose() @IsInt() @Min(1) height!: number
    @Expose() @IsInt() @Min(0) position!: number
}

@Exclude()
export class GigBulletDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() text!: string
    @Expose() @IsInt() @Min(0) position!: number
}

@Exclude()
export class GigFaqDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() question!: string
    @Expose() @IsString() answer!: string
    @Expose() @IsInt() @Min(0) position!: number
}

/**
 * Compact row shape used on My Gigs list. Stat fields (orders/avgRating/earnings)
 * are 0 / null in Feature 04 — Features 09+ will populate.
 */
@Exclude()
export class MyGigListItemDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() title!: string
    @Expose() @IsString() status!: string

    @Expose() @ApiProperty({ description: 'Price in VND, integer.' }) @IsInt() priceVnd!: number
    @Expose() @IsInt() @Min(1) deliveryDays!: number

    @Expose() @IsOptional() @IsString() coverImageUrl!: string | null

    @Expose() @IsString() categoryName!: string

    @Expose() @ApiProperty({ description: 'ISO 8601' }) @IsString() createdAt!: string

    @Expose()
    @ApiProperty({ description: '0 in Feature 04 — Features 09+ will populate.' })
    @IsInt()
    @Min(0)
    ordersCount!: number
    @Expose()
    @ApiProperty({ description: 'null in Feature 04 (no reviews yet).' })
    @IsOptional()
    avgRating!: number | null
    @Expose()
    @ApiProperty({ description: '0 in Feature 04.' })
    @IsInt()
    @Min(0)
    earningsVnd!: number
}

@Exclude()
export class MyGigsCountsDto {
    @Expose() @IsInt() @Min(0) all!: number
    @Expose() @IsInt() @Min(0) active!: number
    @Expose() @IsInt() @Min(0) paused!: number
    @Expose() @IsInt() @Min(0) pending!: number
    @Expose() @IsInt() @Min(0) rejected!: number
}

@Exclude()
export class MyGigsListResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MyGigListItemDto)
    items!: MyGigListItemDto[]
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
    @Expose() @ValidateNested() @Type(() => MyGigsCountsDto) counts!: MyGigsCountsDto
}

@Exclude()
export class MyGigDetailDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() sellerId!: string
    @Expose() @IsString() categoryId!: string
    @Expose() @IsString() categoryName!: string
    @Expose() @IsString() categoryIcon!: string

    @Expose() @IsString() title!: string
    @Expose() @IsString() description!: string
    @Expose() @IsInt() priceVnd!: number
    @Expose() @IsInt() deliveryDays!: number
    @Expose() @IsString() status!: string

    @Expose() @IsOptional() @IsString() rejectionCategory!: string | null
    @Expose() @IsOptional() @IsString() rejectionReason!: string | null

    @Expose() @IsOptional() @IsString() coverImageUrl!: string | null

    @Expose() @IsString() createdAt!: string
    @Expose() @IsOptional() @IsString() submittedAt!: string | null
    @Expose() @IsOptional() @IsString() approvedAt!: string | null
    @Expose() @IsOptional() @IsString() pausedAt!: string | null

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GigImageDto)
    images!: GigImageDto[]
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GigBulletDto)
    bullets!: GigBulletDto[]
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GigFaqDto)
    faqs!: GigFaqDto[]
}

@Exclude()
export class UploadGigImageResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() url!: string
    @Expose() @IsInt() @Min(1) width!: number
    @Expose() @IsInt() @Min(1) height!: number
}

@Exclude()
export class UpdateGigResponseDto {
    @Expose() gig!: MyGigDetailDto
    @Expose() @IsBoolean() statusChanged!: boolean
    @Expose() @IsString() previousStatus!: string
    @Expose() @IsString() newStatus!: string
}
