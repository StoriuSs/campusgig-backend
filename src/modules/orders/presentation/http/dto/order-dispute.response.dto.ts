import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

// F12 — the order's view of its dispute, embedded in OrderDetailResponseDto.
// Evidence carries metadata only; the file is fetched on demand via
// GET /orders/:orderId/dispute/evidence/:evidenceId/url. No adminNotes here.

@Exclude()
export class DisputeEvidenceResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() side!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class DisputePayoutResponseDto {
    @Expose() @IsInt() @Min(0) buyerRefundVnd!: number
    @Expose() @IsInt() @Min(0) sellerEarningVnd!: number
    @Expose() @IsInt() @Min(0) platformFeeVnd!: number
}

@Exclude()
export class OrderDisputeResponseDto {
    @Expose() @IsString() status!: string
    @Expose() @IsString() filedByRole!: string
    @Expose() @IsString() reasonCode!: string
    @Expose() @IsString() filerStatement!: string

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DisputeEvidenceResponseDto)
    filerEvidence!: DisputeEvidenceResponseDto[]

    @Expose() @IsOptional() @IsString() responderStatement!: string | null

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DisputeEvidenceResponseDto)
    responderEvidence!: DisputeEvidenceResponseDto[]

    @Expose() @IsString() filedAt!: string
    @Expose() @IsOptional() @IsString() respondedAt!: string | null
    @Expose() @IsString() responseDeadline!: string

    @Expose() @IsOptional() @IsString() verdict!: string | null
    @Expose() @IsOptional() @IsNumber() buyerRefundPercent!: number | null
    @Expose() @IsOptional() @IsString() adminNotes!: string | null
    @Expose() @IsOptional() @IsString() resolvedAt!: string | null

    @Expose()
    @IsOptional()
    @ValidateNested()
    @Type(() => DisputePayoutResponseDto)
    payout!: DisputePayoutResponseDto | null
}
