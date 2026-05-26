import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateCategoryRequestDto {
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    name!: string

    @IsString()
    @MaxLength(40)
    icon!: string

    @IsOptional()
    @IsString()
    @MaxLength(200)
    description?: string | null
}

export class UpdateCategoryRequestDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    name?: string

    @IsOptional()
    @IsString()
    @MaxLength(40)
    icon?: string

    @IsOptional()
    @IsString()
    @MaxLength(200)
    description?: string | null
}
