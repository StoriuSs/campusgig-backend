import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsString, MaxLength, ValidateNested } from 'class-validator'

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
}

@Exclude()
export class PublicCategoryListResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PublicCategoryResponseDto)
    items!: PublicCategoryResponseDto[]
}
