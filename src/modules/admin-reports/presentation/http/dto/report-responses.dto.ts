import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'

@Exclude()
export class ReportExportRowDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() reportType!: string
    @Expose() @IsString() period!: string
    @Expose() @IsString() filename!: string
    @Expose() @IsOptional() @IsString() adminEmail!: string | null
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class RecentExportsResponseDto {
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => ReportExportRowDto) items!: ReportExportRowDto[]
}
