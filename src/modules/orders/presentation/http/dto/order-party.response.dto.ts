import { Exclude, Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

@Exclude()
export class OrderPartyResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    // Avatar key resolved to presigned URL in the controller.
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    // ISO when endorsed, null otherwise — drives the EndorsedPill on the party card.
    @Expose() @IsOptional() @IsString() endorsedAt!: string | null
}
