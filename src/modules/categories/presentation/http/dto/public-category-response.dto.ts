import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator'

@Exclude()
export class PublicCategoryResponseDto {
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
    description!: string | null

    @Expose()
    @IsInt()
    @Min(0)
    activeGigCount!: number
}

@Exclude()
export class PublicCategoryListResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PublicCategoryResponseDto)
    items!: PublicCategoryResponseDto[]
}
