import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DashboardActionItemDto, DashboardOrderRowDto } from './shared.dto'

@Exclude()
class BuyerStatCardsDto {
    @Expose() @IsInt() ordersCompleted!: number
    @Expose() @IsInt() inEscrowVnd!: number
    @Expose() @IsInt() sellersWorkedWith!: number
    @Expose() @IsInt() totalSpentVnd!: number
}

@Exclude()
class RecommendedGigDto {
    @Expose() @IsString() gigId!: string
    @Expose() @IsString() title!: string
    @Expose() @IsOptional() @IsString() coverUrl!: string | null
    @Expose() @IsString() sellerId!: string
    @Expose() @IsString() sellerName!: string
    @Expose() @IsOptional() @IsString() sellerUsername!: string | null
    @Expose() @IsOptional() @IsString() sellerAvatarUrl!: string | null
    @Expose() @IsBoolean() sellerIsEndorsed!: boolean
    @Expose() @IsNumber() ratingAverage!: number
    @Expose() @IsInt() reviewCount!: number
    @Expose() @IsInt() priceVnd!: number
    @Expose() @IsInt() deliveryDays!: number
}

@Exclude()
export class BuyerDashboardResponseDto {
    @Expose() @ValidateNested() @Type(() => BuyerStatCardsDto) statCards!: BuyerStatCardsDto
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DashboardOrderRowDto)
    recentOrders!: DashboardOrderRowDto[]
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RecommendedGigDto)
    recommendations!: RecommendedGigDto[]
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DashboardActionItemDto)
    actionItems!: DashboardActionItemDto[]
    @Expose() @IsBoolean() hasOrders!: boolean
}
