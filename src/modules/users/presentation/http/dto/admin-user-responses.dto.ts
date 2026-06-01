import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'

// ── List ─────────────────────────────────────────────────────────────────────

@Exclude()
export class AdminUserRowDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() email!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    @Expose() @IsString() joinedAt!: string
    @Expose() @IsInt() @Min(0) activeGigCount!: number
    @Expose() @IsInt() @Min(0) completedOrderCount!: number
    @Expose() @IsInt() @Min(0) reviewCount!: number
    @Expose() @IsOptional() avgRating!: number | null
    @Expose() @IsInt() @Min(0) disputesLost!: number
    @Expose() @IsInt() @Min(0) disputesTotal!: number
    @Expose() @IsBoolean() endorsed!: boolean
}

@Exclude()
export class AdminUsersListResponseDto {
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => AdminUserRowDto) items!: AdminUserRowDto[]
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
    @Expose() @IsInt() @Min(0) totalUsers!: number
    @Expose() @IsInt() @Min(0) endorsedUsers!: number
}

// ── Detail ───────────────────────────────────────────────────────────────────

@Exclude()
export class AdminUserTopGigDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() title!: string
    @Expose() @IsString() status!: string
    @Expose() @IsOptional() avgRating!: number | null
    @Expose() @IsInt() @Min(0) reviewCount!: number
    @Expose() @IsInt() @Min(0) orderCount!: number
}

@Exclude()
export class AdminUserDetailResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsOptional() @IsString() username!: string | null
    @Expose() @IsOptional() @IsString() displayName!: string | null
    @Expose() @IsOptional() @IsString() email!: string | null
    @Expose() @IsOptional() @IsString() avatarUrl!: string | null
    @Expose() @IsString() memberSince!: string
    @Expose() @IsBoolean() endorsed!: boolean
    @Expose() @IsOptional() @IsString() endorsedAt!: string | null
    @Expose() @IsOptional() @IsString() endorsedByEmail!: string | null
    @Expose() @IsOptional() @IsString() adminNote!: string | null
    @Expose() @IsInt() @Min(0) activeGigCount!: number
    @Expose() @IsInt() @Min(0) completedOrderCount!: number
    @Expose() @IsInt() @Min(0) reviewCount!: number
    @Expose() @IsOptional() avgRating!: number | null
    @Expose() @IsInt() @Min(0) disputesLost!: number
    @Expose() @IsInt() @Min(0) disputesTotal!: number
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdminUserTopGigDto)
    topGigs!: AdminUserTopGigDto[]
}
