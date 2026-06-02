import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DashboardActionItemDto, DashboardOrderRowDto, GigEarningSliceDto, SeriesBucketDto } from './shared.dto'

@Exclude()
class EarningsStatDto {
    @Expose() @IsInt() totalVnd!: number
    @Expose() @IsOptional() @IsInt() deltaPercent!: number | null
}

@Exclude()
class EscrowStatDto {
    @Expose() @IsInt() totalVnd!: number
    @Expose() @IsInt() activeOrders!: number
}

@Exclude()
class CompletionStatDto {
    @Expose() @IsOptional() @IsInt() percent!: number | null
    @Expose() @IsInt() completed!: number
    @Expose() @IsInt() total!: number
}

@Exclude()
class RatingStatDto {
    @Expose() @IsNumber() average!: number
    @Expose() @IsInt() reviewCount!: number
}

@Exclude()
class SellerStatCardsDto {
    @Expose() @ValidateNested() @Type(() => EarningsStatDto) earnings!: EarningsStatDto
    @Expose() @ValidateNested() @Type(() => EscrowStatDto) escrow!: EscrowStatDto
    @Expose() @ValidateNested() @Type(() => CompletionStatDto) completionRate!: CompletionStatDto
    @Expose() @ValidateNested() @Type(() => RatingStatDto) rating!: RatingStatDto
}

@Exclude()
class EarningsSeriesDto {
    @Expose() @IsString() period!: string
    @Expose() @IsInt() totalVnd!: number
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => SeriesBucketDto) buckets!: SeriesBucketDto[]
}

@Exclude()
class EarningsByGigDto {
    @Expose() @IsInt() totalVnd!: number
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => GigEarningSliceDto) slices!: GigEarningSliceDto[]
}

@Exclude()
class GigPerformanceRowDto {
    @Expose() @IsString() gigId!: string
    @Expose() @IsString() title!: string
    @Expose() @IsOptional() @IsString() coverUrl!: string | null
    @Expose() @IsInt() views!: number
    @Expose() @IsInt() orders!: number
    @Expose() @IsNumber() conversionPercent!: number
    @Expose() @IsInt() earningsVnd!: number
}

@Exclude()
export class SellerDashboardResponseDto {
    @Expose() @ValidateNested() @Type(() => SellerStatCardsDto) statCards!: SellerStatCardsDto
    @Expose() @ValidateNested() @Type(() => EarningsSeriesDto) earningsSeries!: EarningsSeriesDto
    @Expose() @ValidateNested() @Type(() => EarningsByGigDto) earningsByGig!: EarningsByGigDto
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DashboardOrderRowDto)
    activeOrders!: DashboardOrderRowDto[]
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GigPerformanceRowDto)
    gigPerformance!: GigPerformanceRowDto[]
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DashboardActionItemDto)
    actionItems!: DashboardActionItemDto[]
    @Expose() @IsBoolean() hasGigs!: boolean
    @Expose() @IsBoolean() hasOrders!: boolean
}
