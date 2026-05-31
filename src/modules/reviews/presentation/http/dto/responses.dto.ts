import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

@Exclude()
export class ReviewAuthorResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
}

@Exclude()
export class ReviewResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() gigId!: string
    @Expose() @IsNumber() rating!: number
    @Expose() @IsString() body!: string
    @Expose() @IsOptional() @IsString() replyBody!: string | null
    @Expose() @IsOptional() @IsString() repliedAt!: string | null
    @Expose() @IsString() createdAt!: string
    @Expose() @ValidateNested() @Type(() => ReviewAuthorResponseDto) author!: ReviewAuthorResponseDto
}

@Exclude()
export class GigReviewsListResponseDto {
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => ReviewResponseDto) items!: ReviewResponseDto[]
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
}

@Exclude()
export class ReviewTierCountsResponseDto {
    @Expose() @IsInt() @Min(0) five!: number
    @Expose() @IsInt() @Min(0) four!: number
    @Expose() @IsInt() @Min(0) three!: number
    @Expose() @IsInt() @Min(0) two!: number
    @Expose() @IsInt() @Min(0) one!: number
}

@Exclude()
export class GigReviewSummaryResponseDto {
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsOptional() @IsNumber() average!: number | null
    @Expose() @ValidateNested() @Type(() => ReviewTierCountsResponseDto) tiers!: ReviewTierCountsResponseDto
}

@Exclude()
export class ManageTierCountsResponseDto {
    @Expose() @IsInt() @Min(0) five!: number
    @Expose() @IsInt() @Min(0) four!: number
    @Expose() @IsInt() @Min(0) three!: number
    @Expose() @IsInt() @Min(0) oneToTwo!: number
}

@Exclude()
export class ManageReviewsResponseDto {
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => ReviewResponseDto) items!: ReviewResponseDto[]
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
    @Expose() @IsInt() @Min(0) answeredCount!: number
    @Expose() @IsInt() @Min(0) unansweredCount!: number
    @Expose() @ValidateNested() @Type(() => ManageTierCountsResponseDto) tierCounts!: ManageTierCountsResponseDto
}
