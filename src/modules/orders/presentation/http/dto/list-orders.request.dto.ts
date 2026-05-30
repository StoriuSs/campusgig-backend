import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

const SIDES = ['buyer', 'seller'] as const
const STATUS_FILTER = [
    'all',
    'PendingReview',
    'InProgress',
    'Late',
    'Delivered',
    'AwaitingFinalization',
    'Completed',
    'Cancelled',
    'Frozen'
] as const
const SORTS = ['most_urgent', 'newest', 'oldest', 'amount_desc', 'amount_asc'] as const

export class ListOrdersRequestDto {
    @IsIn(SIDES) side!: (typeof SIDES)[number]

    @IsOptional()
    @IsIn(STATUS_FILTER)
    status?: (typeof STATUS_FILTER)[number]

    // Typed as string deliberately: the global ValidationPipe is configured with
    // `enableImplicitConversion: true`, which would otherwise coerce the wire
    // string 'false' to `Boolean('false') === true` because non-empty strings
    // are truthy in JS. By accepting the raw string here and parsing in the
    // controller, the implicit conversion can't fire.
    @IsOptional() @IsIn(['true', 'false']) actionRequiredOnly?: 'true' | 'false'

    @IsOptional() @IsString() @MaxLength(120) q?: string

    @IsOptional() @IsIn(SORTS) sort?: (typeof SORTS)[number]

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
