import { Exclude, Expose } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator'

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
}
