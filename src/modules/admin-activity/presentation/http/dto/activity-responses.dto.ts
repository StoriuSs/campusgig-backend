import { Exclude, Expose, Transform, Type } from 'class-transformer'
import { IsArray, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

@Exclude()
export class AdminActivityRowDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() actionType!: string
    @Expose() @IsString() targetType!: string
    @Expose() @IsOptional() @IsString() targetId!: string | null
    @Expose() @IsString() summary!: string
    // Passthrough — without @Transform the serializer empties this blob to {}.
    @Expose() @Transform(({ obj }) => obj.metadata) @IsOptional() @IsObject() metadata!: Record<string, unknown> | null
    @Expose() @IsString() adminUserId!: string
    @Expose() @IsOptional() @IsString() adminEmail!: string | null
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class AdminActivityAdminDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() email!: string | null
}

@Exclude()
export class AdminActivityListResponseDto {
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => AdminActivityRowDto) items!: AdminActivityRowDto[]
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdminActivityAdminDto)
    admins!: AdminActivityAdminDto[]
}
