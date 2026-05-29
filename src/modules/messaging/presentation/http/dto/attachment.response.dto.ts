import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsString, Min } from 'class-validator'

@Exclude()
export class AttachmentResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
    // URL is presigned and short-lived; resolved by the controller on read.
    @Expose() @IsString() url!: string
}
