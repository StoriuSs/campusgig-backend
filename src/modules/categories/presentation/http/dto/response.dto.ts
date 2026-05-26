import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

@Exclude()
export class CategoryResponseDto {
    @Expose()
    @IsString()
    id!: string

    @Expose()
    @IsString()
    @MaxLength(50)
    name!: string

    @Expose()
    @IsString()
    @MaxLength(40)
    icon!: string

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    description?: string | null

    @Expose()
    @ApiProperty({ description: 'Number of non-deleted gigs in this category. 0 in Feature 03 (no Gig table yet).' })
    @IsInt()
    @Min(0)
    gigCount!: number

    @Expose()
    @ApiProperty({
        description: 'Number of orders placed against gigs in this category over the last 30 days. 0 in Feature 03.'
    })
    @IsInt()
    @Min(0)
    orders30d!: number

    @Expose()
    @ApiProperty({ description: 'ISO 8601 timestamp when the category was created.' })
    @IsString()
    createdAt!: string
}

@Exclude()
export class ListCategoriesResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CategoryResponseDto)
    items!: CategoryResponseDto[]

    @Expose()
    @ApiProperty({ description: 'Total number of categories across all pages.' })
    @IsInt()
    @Min(0)
    total!: number

    @Expose()
    @IsInt()
    @Min(1)
    page!: number

    @Expose()
    @IsInt()
    @Min(1)
    pageSize!: number
}
