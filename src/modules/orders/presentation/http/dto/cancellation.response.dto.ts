import { Exclude, Expose } from 'class-transformer'
import { IsIn, IsOptional, IsString } from 'class-validator'

const CANCELLATION_STATUSES = ['Pending', 'Accepted', 'Rejected', 'Expired'] as const
const CANCELLATION_INITIATORS = ['Buyer', 'Seller'] as const
const CANCELLATION_REASON_CODES = [
    'BuyerSituationChanged',
    'BuyerOrderedByMistake',
    'BuyerAgreedInChat',
    'BuyerOther',
    'SellerScheduleConflict',
    'SellerRequirementsMismatch',
    'SellerAgreedInChat',
    'SellerOther'
] as const

@Exclude()
export class CancellationResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() orderId!: string
    @Expose() @IsString() requestedById!: string
    @Expose() @IsIn(CANCELLATION_INITIATORS) initiator!: (typeof CANCELLATION_INITIATORS)[number]
    @Expose() @IsIn(CANCELLATION_REASON_CODES) reasonCode!: (typeof CANCELLATION_REASON_CODES)[number]
    @Expose() @IsOptional() @IsString() otherText!: string | null
    @Expose() @IsIn(CANCELLATION_STATUSES) status!: (typeof CANCELLATION_STATUSES)[number]
    @Expose() @IsString() expiresAt!: string
    @Expose() @IsString() requestedAt!: string
    @Expose() @IsOptional() @IsString() decidedAt!: string | null
    @Expose() @IsOptional() @IsString() decidedById!: string | null
}
