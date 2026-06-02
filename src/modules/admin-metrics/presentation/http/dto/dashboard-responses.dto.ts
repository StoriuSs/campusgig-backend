import { Exclude, Expose, Transform, Type } from 'class-transformer'
import { IsArray, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

@Exclude()
export class RevenueStatDto {
    @Expose() @IsInt() @Min(0) totalVnd!: number
    @Expose() @IsOptional() @IsInt() momPercent!: number | null
}

@Exclude()
export class TransactionsStatDto {
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(0) thisMonth!: number
}

@Exclude()
export class ActiveUsersStatDto {
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(0) sellers!: number
    @Expose() @IsInt() @Min(0) buyers!: number
}

@Exclude()
export class ActiveGigsStatDto {
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(0) pendingReview!: number
}

@Exclude()
export class DashboardStatCardsDto {
    @Expose() @ValidateNested() @Type(() => RevenueStatDto) revenue!: RevenueStatDto
    @Expose() @ValidateNested() @Type(() => TransactionsStatDto) transactions!: TransactionsStatDto
    @Expose() @ValidateNested() @Type(() => ActiveUsersStatDto) activeUsers!: ActiveUsersStatDto
    @Expose() @ValidateNested() @Type(() => ActiveGigsStatDto) activeGigs!: ActiveGigsStatDto
}

@Exclude()
export class RevenueBucketDto {
    @Expose() @IsString() label!: string
    @Expose() @IsInt() @Min(0) valueVnd!: number
}

@Exclude()
export class RevenueSeriesDto {
    @Expose() @IsString() period!: string
    @Expose() @IsInt() @Min(0) totalVnd!: number
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => RevenueBucketDto) buckets!: RevenueBucketDto[]
}

@Exclude()
export class CategorySliceDto {
    @Expose() @IsOptional() @IsString() categoryId!: string | null
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) count!: number
}

@Exclude()
export class CategoryDistributionDto {
    @Expose() @IsInt() @Min(0) totalGigs!: number
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => CategorySliceDto) slices!: CategorySliceDto[]
}

@Exclude()
export class TopSellerDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    @Expose() @IsInt() @Min(0) earningsVnd!: number
}

@Exclude()
export class ActionRequiredDto {
    @Expose() @IsInt() @Min(0) pendingGigs!: number
    @Expose() @IsInt() @Min(0) openDisputes!: number
    @Expose() @IsInt() @Min(0) pendingWithdrawals!: number
}

@Exclude()
export class DashboardActivityDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() actionType!: string
    @Expose() @IsString() targetType!: string
    @Expose() @IsOptional() @IsString() targetId!: string | null
    @Expose() @IsString() summary!: string
    // Passthrough — without @Transform the serializer empties this blob to {}.
    @Expose() @Transform(({ obj }) => obj.metadata) @IsOptional() @IsObject() metadata!: Record<string, unknown> | null
    @Expose() @IsOptional() @IsString() adminEmail!: string | null
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class DashboardResponseDto {
    @Expose() @ValidateNested() @Type(() => DashboardStatCardsDto) statCards!: DashboardStatCardsDto
    @Expose() @ValidateNested() @Type(() => RevenueSeriesDto) revenueSeries!: RevenueSeriesDto
    @Expose() @ValidateNested() @Type(() => CategoryDistributionDto) categoryDistribution!: CategoryDistributionDto
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => TopSellerDto) topSellers!: TopSellerDto[]
    @Expose() @ValidateNested() @Type(() => ActionRequiredDto) actionRequired!: ActionRequiredDto
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DashboardActivityDto)
    recentActivity!: DashboardActivityDto[]
}
