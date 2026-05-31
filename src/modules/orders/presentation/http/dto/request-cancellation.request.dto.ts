import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

const REASON_CODES = [
    'BuyerSituationChanged',
    'BuyerOrderedByMistake',
    'BuyerAgreedInChat',
    'BuyerOther',
    'SellerScheduleConflict',
    'SellerRequirementsMismatch',
    'SellerAgreedInChat',
    'SellerOther'
] as const

export class RequestCancellationRequestDto {
    // Initiator role enforced server-side: only Buyer*-codes from a buyer
    // viewer, only Seller*-codes from a seller viewer. Handler does that
    // cross-check against the order's parties.
    @IsIn(REASON_CODES) reasonCode!: (typeof REASON_CODES)[number]

    // Required when reasonCode ends in 'Other'. Capped at 500 chars to keep
    // the decision card readable. Server enforces the requirement.
    @IsOptional() @IsString() @MaxLength(500) otherText?: string
}
