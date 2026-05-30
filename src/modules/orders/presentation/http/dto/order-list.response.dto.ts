import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

const ORDER_STATUSES = [
    'PendingReview',
    'InProgress',
    'Late',
    'Delivered',
    'AwaitingFinalization',
    'Completed',
    'Cancelled',
    'Frozen'
] as const

const CANCELLATION_INITIATORS = ['Buyer', 'Seller'] as const

@Exclude()
export class OrderListRowResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() code!: string
    @Expose() @IsInt() @Min(1) number!: number
    @Expose() @IsIn(ORDER_STATUSES) status!: (typeof ORDER_STATUSES)[number]

    @Expose() @IsString() gigTitle!: string
    @Expose() @IsOptional() @IsString() gigCoverUrl!: string | null

    @Expose() @IsString() counterpartyId!: string
    @Expose() @IsOptional() @IsString() counterpartyDisplayName!: string | null
    @Expose() @IsOptional() @IsString() counterpartyUsername!: string | null
    @Expose() @IsOptional() @IsString() counterpartyAvatarUrl!: string | null

    @Expose() @IsString() placedAt!: string
    @Expose() @IsInt() @Min(0) amountVnd!: number

    @Expose() @IsOptional() @IsString() acceptDeadline!: string | null
    @Expose() @IsOptional() @IsString() deliveryDeadline!: string | null
    @Expose() @IsOptional() @IsString() reviewDeadline!: string | null
    @Expose() @IsOptional() @IsString() disputeDeadline!: string | null

    @Expose() @IsOptional() @IsString() pendingExtensionExpiresAt!: string | null
    @Expose() @IsOptional() @IsString() pendingCancellationExpiresAt!: string | null
    @Expose()
    @IsOptional()
    @IsIn(CANCELLATION_INITIATORS)
    pendingCancellationInitiator!: (typeof CANCELLATION_INITIATORS)[number] | null

    @Expose() @IsBoolean() actionRequired!: boolean
}

@Exclude()
export class OrderStatusCountsResponseDto {
    @Expose() @IsInt() @Min(0) all!: number
    @Expose() @IsInt() @Min(0) PendingReview!: number
    @Expose() @IsInt() @Min(0) InProgress!: number
    @Expose() @IsInt() @Min(0) Late!: number
    @Expose() @IsInt() @Min(0) Delivered!: number
    @Expose() @IsInt() @Min(0) AwaitingFinalization!: number
    @Expose() @IsInt() @Min(0) Completed!: number
    @Expose() @IsInt() @Min(0) Cancelled!: number
}

@Exclude()
export class OrderListResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderListRowResponseDto)
    items!: OrderListRowResponseDto[]

    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number

    @Expose()
    @ValidateNested()
    @Type(() => OrderStatusCountsResponseDto)
    counts!: OrderStatusCountsResponseDto
}
