import { IsString, Length } from 'class-validator'

export class DeclineOrderRequestDto {
    // Seller must give a reason — surfaced to the buyer in the Cancelled banner.
    @IsString() @Length(1, 500) note!: string
}
