import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { GigImageDto, GigBulletDto, GigFaqDto } from './response.dto'

@Exclude()
export class AdminQueueSellerDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsString() displayName!: string
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    @Expose() @IsBoolean() isEndorsed!: boolean
}

@Exclude()
export class AdminQueueRowDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() title!: string
    @Expose() @IsString() status!: string

    @Expose() @ApiProperty({ description: 'Price in VND, integer.' }) @IsInt() priceVnd!: number
    @Expose() @IsInt() @Min(1) deliveryDays!: number

    @Expose() @IsOptional() @IsString() coverImageUrl!: string | null
    @Expose() @IsString() categoryName!: string

    @Expose()
    @ApiProperty({ description: 'True when the gig was approved before (re-review), false for a first submission.' })
    @IsBoolean()
    isReReview!: boolean

    @Expose()
    @ApiProperty({ description: 'ISO 8601 — when the gig last entered Pending review.' })
    @IsOptional()
    @IsString()
    submittedAt!: string | null

    @Expose() @ValidateNested() @Type(() => AdminQueueSellerDto) seller!: AdminQueueSellerDto
}

@Exclude()
export class AdminQueueCountsDto {
    @Expose() @IsInt() @Min(0) all!: number
    @Expose() @IsInt() @Min(0) firstSubmission!: number
    @Expose() @IsInt() @Min(0) reReview!: number
}

@Exclude()
export class AdminGigQueueResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdminQueueRowDto)
    items!: AdminQueueRowDto[]
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
    @Expose() @ValidateNested() @Type(() => AdminQueueCountsDto) counts!: AdminQueueCountsDto
}

@Exclude()
export class AdminGigDetailSellerDto extends AdminQueueSellerDto {
    @Expose()
    @ApiProperty({ description: 'ISO 8601 — seller account creation (membership) date.' })
    @IsString()
    joinedAt!: string
}

@Exclude()
export class AdminGigDetailDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() categoryId!: string
    @Expose() @IsString() categoryName!: string
    @Expose() @IsString() categoryIcon!: string

    @Expose() @IsString() title!: string
    @Expose() @IsString() description!: string
    @Expose() @IsInt() priceVnd!: number
    @Expose() @IsInt() deliveryDays!: number
    @Expose() @IsString() status!: string
    @Expose() @IsBoolean() isReReview!: boolean

    @Expose() @IsOptional() @IsString() rejectionCategory!: string | null
    @Expose() @IsOptional() @IsString() rejectionReason!: string | null

    @Expose() @IsString() createdAt!: string
    @Expose() @IsOptional() @IsString() submittedAt!: string | null
    @Expose() @IsOptional() @IsString() approvedAt!: string | null

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

    @Expose() @ValidateNested() @Type(() => AdminGigDetailSellerDto) seller!: AdminGigDetailSellerDto
}
