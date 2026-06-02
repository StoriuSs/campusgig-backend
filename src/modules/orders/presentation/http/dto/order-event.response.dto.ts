import { Exclude, Expose, Transform } from 'class-transformer'
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator'

const ORDER_EVENT_TYPES = [
    'Placed',
    'Accepted',
    'Declined',
    'AutoCancelled',
    'Late',
    'Delivered',
    'DeliveryUpdated',
    'ExtensionRequested',
    'ExtensionAccepted',
    'ExtensionRejected',
    'ExtensionExpired',
    'CancellationRequested',
    'CancellationAccepted',
    'CancellationRejected',
    'CancellationExpired',
    'AcceptDelivery',
    'AutoCompleted',
    'Finalized'
] as const

@Exclude()
export class OrderEventResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() orderId!: string
    @Expose() @IsIn(ORDER_EVENT_TYPES) type!: (typeof ORDER_EVENT_TYPES)[number]
    @Expose() @IsOptional() @IsString() actorUserId!: string | null
    // Passthrough — without @Transform the serializer empties this blob to {}.
    @Expose() @Transform(({ obj }) => obj.payload) @IsOptional() @IsObject() payload!: Record<string, unknown> | null
    @Expose() @IsString() createdAt!: string
}
