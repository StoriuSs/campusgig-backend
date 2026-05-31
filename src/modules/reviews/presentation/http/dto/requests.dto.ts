import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

const PUBLIC_TIERS = ['all', '5', '4', '3', '2', '1'] as const
const MANAGE_TIERS = ['all', '5', '4', '3', '1-2'] as const
const MANAGE_STATUS = ['all', 'unanswered', 'answered'] as const
const MANAGE_SORTS = ['newest', 'oldest', 'highest', 'lowest'] as const

export class SubmitReviewRequestDto {
    // 1-5 in 0.5 steps; the controller converts to integer half-stars.
    @IsNumber() @Min(1) @Max(5) rating!: number
    @IsString() @MinLength(1) @MaxLength(1000) body!: string
}

export class ReplyToReviewRequestDto {
    @IsString() @MinLength(1) @MaxLength(1000) body!: string
}

export class ListGigReviewsRequestDto {
    @IsOptional() @IsIn(PUBLIC_TIERS) tier?: (typeof PUBLIC_TIERS)[number]
    @IsOptional() @IsString() @MaxLength(120) q?: string

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    page?: number

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    @Max(50)
    pageSize?: number
}

export class ManageReviewsRequestDto {
    @IsOptional() @IsIn(MANAGE_STATUS) status?: (typeof MANAGE_STATUS)[number]
    @IsOptional() @IsIn(MANAGE_TIERS) tier?: (typeof MANAGE_TIERS)[number]
    @IsOptional() @IsIn(MANAGE_SORTS) sort?: (typeof MANAGE_SORTS)[number]

    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    page?: number
}
