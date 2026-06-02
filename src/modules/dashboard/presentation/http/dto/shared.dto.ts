import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

@Exclude()
export class DashboardActionItemDto {
    @Expose() @IsString() orderId!: string
    @Expose() @IsString() code!: string
    @Expose() @IsString() type!: string
    @Expose() @IsString() otherPartyName!: string
    @Expose() @IsOptional() @IsString() deadlineAt!: string | null
}

@Exclude()
export class DashboardOrderRowDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() code!: string
    @Expose() @IsString() gigTitle!: string
    @Expose() @IsOptional() @IsString() gigCoverUrl!: string | null
    @Expose() @IsString() otherPartyName!: string
    @Expose() @IsOptional() @IsString() otherPartyAvatarUrl!: string | null
    @Expose() @IsString() status!: string
    @Expose() @IsString() placedAt!: string
    @Expose() @IsOptional() @IsString() deadlineAt!: string | null
    @Expose() @IsInt() amountVnd!: number
}

@Exclude()
export class SeriesBucketDto {
    @Expose() @IsString() label!: string
    @Expose() @IsInt() valueVnd!: number
}

@Exclude()
export class GigEarningSliceDto {
    @Expose() @IsOptional() @IsString() gigId!: string | null
    @Expose() @IsString() title!: string
    @Expose() @IsInt() earningsVnd!: number
}

@Exclude()
export class ActionItemsMixin {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DashboardActionItemDto)
    actionItems!: DashboardActionItemDto[]
}

export { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, ValidateNested, Exclude, Expose, Type }
