import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested
} from 'class-validator'
import { Type } from 'class-transformer'

export class GigFaqInputDto {
    @IsString()
    @MinLength(5)
    @MaxLength(120)
    question!: string

    @IsString()
    @MinLength(10)
    @MaxLength(500)
    answer!: string
}

export class CreateGigRequestDto {
    @IsString()
    @MinLength(10)
    @MaxLength(100)
    title!: string

    @IsString()
    categoryId!: string

    @IsString()
    @MinLength(30)
    @MaxLength(5000)
    description!: string

    @IsInt()
    @Min(1_000)
    @Max(50_000_000)
    priceVnd!: number

    @IsInt()
    @Min(1)
    @Max(30)
    deliveryDays!: number

    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(10)
    @IsString({ each: true })
    imageIds!: string[]

    @IsArray()
    @ArrayMaxSize(5)
    @IsString({ each: true })
    bullets!: string[]

    @IsArray()
    @ArrayMaxSize(5)
    @ValidateNested({ each: true })
    @Type(() => GigFaqInputDto)
    faqs!: GigFaqInputDto[]
}

export class UpdateGigRequestDto {
    @IsOptional() @IsString() @MinLength(10) @MaxLength(100) title?: string
    @IsOptional() @IsString() categoryId?: string
    @IsOptional() @IsString() @MinLength(30) @MaxLength(5000) description?: string
    @IsOptional() @IsInt() @Min(1_000) @Max(50_000_000) priceVnd?: number
    @IsOptional() @IsInt() @Min(1) @Max(30) deliveryDays?: number

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(10)
    @IsString({ each: true })
    imageIds?: string[]

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(5)
    @IsString({ each: true })
    bullets?: string[]

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(5)
    @ValidateNested({ each: true })
    @Type(() => GigFaqInputDto)
    faqs?: GigFaqInputDto[]
}

export class ReorderGigImagesRequestDto {
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(10)
    @IsString({ each: true })
    imageIds!: string[]
}
