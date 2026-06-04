import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsNumber } from 'class-validator'

@Exclude()
export class LandingStatsResponseDto {
    @Expose() @IsInt() studentCount!: number
    @Expose() @IsNumber() averageRating!: number
    @Expose() @IsInt() reviewCount!: number
}
