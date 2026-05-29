import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator'
import { AttachmentResponseDto } from './attachment.response.dto'

@Exclude()
export class MessageItemResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() threadId!: string
    @Expose() @IsOptional() @IsString() senderId!: string | null
    @Expose() @IsOptional() @IsString() body!: string | null
    @Expose() @IsOptional() @IsString() orderId!: string | null
    @Expose() @IsString() createdAt!: string

    // Nested DTO array — both @Type() AND a class-validator decorator are
    // required, else validateSync with whitelist:true strips the field.
    // (Lesson from F07.)
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttachmentResponseDto)
    attachments!: AttachmentResponseDto[]

    @Expose() @IsBoolean() readByRecipient!: boolean
}
