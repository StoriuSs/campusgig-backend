import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

@Exclude()
export class FileItemResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() messageId!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
    @Expose() @IsOptional() @IsString() senderId!: string | null
    @Expose() @IsOptional() @IsString() senderName!: string | null
    @Expose() @IsString() createdAt!: string
}
