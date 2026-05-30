import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class DeliverWorkRequestDto {
    // Note is optional — the seller can ship a files-only delivery. We still
    // cap at 5000 chars to match the underlying column. Empty / missing both
    // normalise to an empty string in the handler.
    @IsOptional() @IsString() @MaxLength(5000) note?: string

    // Staged DeliveryFile IDs the seller has uploaded via the staging endpoint.
    // At least one required per F09 spec; cap at 10 per M5 modal.
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(10)
    @IsUUID('all', { each: true })
    stagedFileIds!: string[]
}
