import { Exclude, Expose } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, IsUUID } from 'class-validator'

const MAX_BODY_LENGTH = 5000
const MAX_ATTACHMENTS = 5

@Exclude()
export class SendMessageRequestDto {
    @Expose() @IsOptional() @IsString() @MaxLength(MAX_BODY_LENGTH) body?: string

    @Expose()
    @IsArray()
    @ArrayMaxSize(MAX_ATTACHMENTS)
    @IsString({ each: true })
    attachmentIds!: string[]

    // Order Workspace tags every outgoing message with the order ID so the
    // workspace can isolate its chat from the parties' inbox history (F10
    // requirement — each order has its own thread surface, even though all
    // messages live on the same buyer↔seller thread row). Inbox messages
    // omit this field entirely.
    @Expose() @IsOptional() @IsUUID() orderId?: string
}
