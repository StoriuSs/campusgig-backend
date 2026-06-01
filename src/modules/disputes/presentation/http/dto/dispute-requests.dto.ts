import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength
} from 'class-validator'

const REASON_CODES = [
    'WorkNotAsDescribed',
    'SellerNeverDelivered',
    'SellerHarassment',
    'BuyerOther',
    'BuyerOutOfScope',
    'BuyerReviewThreat',
    'BuyerUnreachable',
    'SellerOther'
]
const VERDICTS = ['RefundBuyer', 'CompleteForSeller', 'SplitFunds']

const MAX_EVIDENCE = 10

export class FileDisputeRequestDto {
    @IsIn(REASON_CODES) reasonCode!: string
    @IsString() @MinLength(10) @MaxLength(2000) statement!: string
    @IsOptional() @IsArray() @ArrayMaxSize(MAX_EVIDENCE) @IsString({ each: true }) evidenceFileIds?: string[]
}

export class RespondDisputeRequestDto {
    @IsString() @MinLength(10) @MaxLength(2000) statement!: string
    @IsOptional() @IsArray() @ArrayMaxSize(MAX_EVIDENCE) @IsString({ each: true }) evidenceFileIds?: string[]
}

export class AddEvidenceRequestDto {
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_EVIDENCE) @IsString({ each: true }) evidenceFileIds!: string[]
}

export class SubmitVerdictRequestDto {
    @IsIn(VERDICTS) verdict!: string
    // Required + validated 0–80 only for SplitFunds (enforced in the domain).
    @IsOptional() @IsInt() @Min(0) @Max(80) buyerRefundPercent?: number
    @IsOptional() @IsString() @MaxLength(2000) adminNotes?: string
}
