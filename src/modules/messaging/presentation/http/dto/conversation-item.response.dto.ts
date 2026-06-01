import { Exclude, Expose, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

@Exclude()
export class ThreadCounterpartDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    // Resolved to a presigned URL in the controller.
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
}

@Exclude()
export class MessagePreviewDto {
    @Expose() @IsOptional() @IsString() body!: string | null
    @Expose() @IsOptional() @IsString() senderId!: string | null
    @Expose() @IsString() createdAt!: string
    @Expose() @IsBoolean() hasAttachments!: boolean
}

@Exclude()
export class ConversationItemResponseDto {
    @Expose() @IsString() threadId!: string

    @Expose()
    @ValidateNested()
    @Type(() => ThreadCounterpartDto)
    otherUser!: ThreadCounterpartDto

    @Expose()
    @IsOptional()
    @ValidateNested()
    @Type(() => MessagePreviewDto)
    lastMessage!: MessagePreviewDto | null

    @Expose() @IsInt() @Min(0) unreadCount!: number
    @Expose() @IsBoolean() online!: boolean
    @Expose() @IsOptional() @IsString() lastSeenAt!: string | null
    @Expose() @IsBoolean() frozen!: boolean
}
