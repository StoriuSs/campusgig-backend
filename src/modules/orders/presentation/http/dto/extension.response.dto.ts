import { Exclude, Expose } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'

const EXTENSION_STATUSES = ['Pending', 'Accepted', 'Rejected', 'Expired'] as const

@Exclude()
export class ExtensionResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() orderId!: string
    @Expose() @IsString() requestedById!: string
    @Expose() @IsInt() @Min(1) hoursRequested!: number
    @Expose() @IsOptional() @IsString() reason!: string | null
    @Expose() @IsIn(EXTENSION_STATUSES) status!: (typeof EXTENSION_STATUSES)[number]
    @Expose() @IsString() expiresAt!: string
    @Expose() @IsString() requestedAt!: string
    @Expose() @IsOptional() @IsString() decidedAt!: string | null
    @Expose() @IsOptional() @IsString() decidedById!: string | null
}
