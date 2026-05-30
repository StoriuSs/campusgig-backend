import { IsString, IsUUID, Length } from 'class-validator'

export class PlaceOrderRequestDto {
    @IsUUID() gigId!: string
    // Required for idempotent retries — F09 spec mandates the client send a
    // fresh UUIDv4 per checkout intent.
    @IsString() @Length(8, 64) idempotencyKey!: string
}
