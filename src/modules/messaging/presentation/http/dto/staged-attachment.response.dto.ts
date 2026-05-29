import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsString, Min } from 'class-validator'

// Returned from POST /threads/:id/attachments (per-file). The frontend
// carries the `id` into the subsequent POST /threads/:id/messages payload.
@Exclude()
export class StagedAttachmentResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
}
