import { Exclude, Expose, Type } from 'class-transformer'
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

import { CancellationResponseDto } from './cancellation.response.dto'
import { DeliveryResponseDto } from './delivery.response.dto'
import { ExtensionResponseDto } from './extension.response.dto'
import { GigSnapshotResponseDto } from './gig-snapshot.response.dto'
import { OrderPartyResponseDto } from './order-party.response.dto'

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

@Exclude()
export class OrderReviewResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsNumber() rating!: number
    @Expose() @IsString() body!: string
    @Expose() @IsOptional() @IsString() replyBody!: string | null
    @Expose() @IsOptional() @IsString() repliedAt!: string | null
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class OrderDetailResponseDto {
    @Expose() @IsString() id!: string
    // Derived public code "CG-{number}" formatted at the controller.
    @Expose() @IsString() code!: string
    @Expose() @IsInt() @Min(1) number!: number
    @Expose() @IsIn(ORDER_STATUSES) status!: (typeof ORDER_STATUSES)[number]

    @Expose() @ValidateNested() @Type(() => OrderPartyResponseDto) buyer!: OrderPartyResponseDto
    @Expose() @ValidateNested() @Type(() => OrderPartyResponseDto) seller!: OrderPartyResponseDto
    @Expose() @ValidateNested() @Type(() => GigSnapshotResponseDto) gig!: GigSnapshotResponseDto

    @Expose() @IsString() placedAt!: string
    @Expose() @IsOptional() @IsString() acceptedAt!: string | null
    @Expose() @IsOptional() @IsString() deliveredAt!: string | null
    @Expose() @IsOptional() @IsString() completedAt!: string | null
    @Expose() @IsOptional() @IsString() cancelledAt!: string | null
    @Expose() @IsOptional() @IsString() autoCompletedAt!: string | null

    @Expose() @IsOptional() @IsString() acceptDeadline!: string | null
    @Expose() @IsOptional() @IsString() deliveryDeadline!: string | null
    @Expose() @IsOptional() @IsString() reviewDeadline!: string | null
    @Expose() @IsOptional() @IsString() disputeDeadline!: string | null

    @Expose() @IsOptional() @IsString() cancelledByUserId!: string | null
    @Expose() @IsOptional() @IsString() cancellationReason!: string | null

    @Expose()
    @IsOptional()
    @ValidateNested()
    @Type(() => DeliveryResponseDto)
    latestDelivery!: DeliveryResponseDto | null

    @Expose()
    @IsOptional()
    @ValidateNested()
    @Type(() => ExtensionResponseDto)
    pendingExtension!: ExtensionResponseDto | null

    @Expose()
    @IsOptional()
    @ValidateNested()
    @Type(() => CancellationResponseDto)
    pendingCancellation!: CancellationResponseDto | null

    @Expose() @IsInt() @Min(0) deliveryCount!: number

    @Expose()
    @IsOptional()
    @ValidateNested()
    @Type(() => OrderReviewResponseDto)
    review!: OrderReviewResponseDto | null
}
