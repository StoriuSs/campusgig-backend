import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

// ── List ─────────────────────────────────────────────────────────────────────

@Exclude()
export class AdminDisputePartySummaryDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
}

@Exclude()
export class AdminDisputeRowDto {
    @Expose() @IsString() orderId!: string
    @Expose() @IsString() code!: string
    @Expose() @IsInt() number!: number
    @Expose() @IsString() gigTitle!: string
    @Expose() @IsString() status!: string
    @Expose() @IsString() filedByRole!: string
    @Expose() @IsString() filedAt!: string
    @Expose() @IsString() responseDeadline!: string
    @Expose() @IsInt() @Min(0) amountVnd!: number
    @Expose() @ValidateNested() @Type(() => AdminDisputePartySummaryDto) buyer!: AdminDisputePartySummaryDto
    @Expose() @ValidateNested() @Type(() => AdminDisputePartySummaryDto) seller!: AdminDisputePartySummaryDto
}

@Exclude()
export class AdminDisputeCountsDto {
    @Expose() @IsInt() @Min(0) ready!: number
    @Expose() @IsInt() @Min(0) awaiting!: number
    @Expose() @IsInt() @Min(0) resolved!: number
}

@Exclude()
export class AdminDisputeListResponseDto {
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => AdminDisputeRowDto) items!: AdminDisputeRowDto[]
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
    @Expose() @ValidateNested() @Type(() => AdminDisputeCountsDto) counts!: AdminDisputeCountsDto
}

// ── Detail ───────────────────────────────────────────────────────────────────

@Exclude()
export class AdminEvidenceDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() side!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
    // `url` renders inline (preview); `downloadUrl` forces Save As.
    @Expose() @IsString() url!: string
    @Expose() @IsString() downloadUrl!: string
}

@Exclude()
export class AdminDisputePartyDto {
    @Expose() @IsString() userId!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    @Expose() endorsed!: boolean
    @Expose() @IsOptional() avgRating!: number | null
    @Expose() @IsInt() @Min(0) reviewCount!: number
    @Expose() @IsString() role!: string
    @Expose() @IsOptional() @IsString() reasonCode!: string | null
    @Expose() @IsOptional() @IsString() statement!: string | null
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => AdminEvidenceDto) evidence!: AdminEvidenceDto[]
}

@Exclude()
export class AdminPayoutDto {
    @Expose() @IsInt() @Min(0) buyerRefundVnd!: number
    @Expose() @IsInt() @Min(0) sellerEarningVnd!: number
    @Expose() @IsInt() @Min(0) platformFeeVnd!: number
}

@Exclude()
export class AdminDeliveryFileDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
    @Expose() @IsString() url!: string
    @Expose() @IsString() downloadUrl!: string
}

@Exclude()
export class AdminDeliveryDto {
    @Expose() @IsString() id!: string
    @Expose() @IsInt() version!: number
    @Expose() @IsString() note!: string
    @Expose() @IsString() deliveredAt!: string
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdminDeliveryFileDto)
    files!: AdminDeliveryFileDto[]
}

@Exclude()
export class AdminChatMessageDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() senderId!: string | null
    @Expose() @IsOptional() @IsString() body!: string | null
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class AdminDisputeDetailResponseDto {
    @Expose() @IsString() orderId!: string
    @Expose() @IsString() code!: string
    @Expose() @IsInt() number!: number
    @Expose() @IsString() gigId!: string
    @Expose() @IsString() status!: string
    @Expose() @IsInt() @Min(0) amountVnd!: number
    @Expose() @IsString() gigTitle!: string
    @Expose() @IsString() placedAt!: string
    @Expose() @IsString() filedAt!: string
    @Expose() @IsOptional() @IsString() respondedAt!: string | null
    @Expose() @IsString() responseDeadline!: string
    @Expose() @ValidateNested() @Type(() => AdminDisputePartyDto) filer!: AdminDisputePartyDto
    @Expose() @ValidateNested() @Type(() => AdminDisputePartyDto) counterparty!: AdminDisputePartyDto
    @Expose() @IsOptional() @IsString() verdict!: string | null
    @Expose() @IsOptional() @IsInt() buyerRefundPercent!: number | null
    @Expose() @IsOptional() @IsString() adminNotes!: string | null
    @Expose() @IsOptional() @IsString() resolvedAt!: string | null
    @Expose() @IsOptional() @ValidateNested() @Type(() => AdminPayoutDto) payout!: AdminPayoutDto | null
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => AdminDeliveryDto) deliveries!: AdminDeliveryDto[]
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => AdminChatMessageDto) chat!: AdminChatMessageDto[]
}
