import { Exclude, Expose, Type } from 'class-transformer'
import {
    IsString,
    IsBoolean,
    IsOptional,
    IsArray,
    IsEmail,
    IsInt,
    Min,
    MaxLength,
    ValidateNested
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

// ============================================
// Response DTOs for HTTP endpoints
// ============================================

@Exclude()
export class SkillResponseDto {
    @Expose()
    @IsString()
    id!: string

    @Expose()
    @IsString()
    @MaxLength(30)
    name!: string

    @Expose()
    @IsInt()
    @Min(0)
    position!: number
}

@Exclude()
export class PortfolioItemResponseDto {
    @Expose()
    @IsString()
    id!: string

    @Expose()
    @ApiProperty({ description: 'Presigned S3 GET URL (1-hour TTL)' })
    @IsString()
    imageUrl!: string

    @Expose()
    @IsInt()
    @Min(1)
    width!: number

    @Expose()
    @IsInt()
    @Min(1)
    height!: number

    @Expose()
    @IsInt()
    @Min(0)
    position!: number
}

@Exclude()
export class UserProfileResponseDto {
    @Expose()
    @IsString()
    id: string

    @Expose()
    @IsEmail()
    email: string

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(50)
    username?: string

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    displayName?: string

    @Expose()
    @IsOptional()
    @IsString()
    avatarUrl?: string | null

    @Expose()
    @IsBoolean()
    emailVerified: boolean

    @Expose()
    @IsArray()
    @IsString({ each: true })
    roles: string[]

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    bio?: string

    @Expose()
    @IsOptional()
    @IsBoolean()
    hasSetUsername?: boolean

    // ─── Feature 02 additions ────────────────────────────────────

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    location?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    roleLine?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    languages?: string | null

    @Expose()
    @ApiProperty({ description: 'True if the user has been granted the Endorsed badge by an admin' })
    @IsBoolean()
    endorsed!: boolean

    @Expose()
    @ApiProperty({ description: 'ISO 8601 date string derived from createdAt' })
    @IsString()
    memberSince!: string

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SkillResponseDto)
    skills!: SkillResponseDto[]

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PortfolioItemResponseDto)
    portfolioItems!: PortfolioItemResponseDto[]

    @Expose()
    @ApiProperty({
        description:
            'True when the user has the `admin` Keycloak realm role. Admins do not appear in Browse and have no public profile.'
    })
    @IsBoolean()
    isAdmin!: boolean
}

@Exclude()
export class PublicProfileResponseDto {
    @Expose()
    @IsString()
    id!: string

    @Expose()
    @IsString()
    @MaxLength(50)
    username!: string

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    displayName?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    avatarUrl?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    bio?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    location?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    roleLine?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    languages?: string | null

    @Expose()
    @ApiProperty({ description: 'True if the user has been granted the Endorsed badge by an admin' })
    @IsBoolean()
    endorsed!: boolean

    @Expose()
    @ApiProperty({ description: 'ISO 8601 date string derived from createdAt' })
    @IsString()
    memberSince!: string

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SkillResponseDto)
    skills!: SkillResponseDto[]

    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PortfolioItemResponseDto)
    portfolioItems!: PortfolioItemResponseDto[]
}

@Exclude()
export class UpdateProfileResponseDto {
    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(50)
    username?: string

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    displayName?: string

    @Expose()
    @IsOptional()
    @IsString()
    avatarUrl?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    bio?: string

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    location?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(100)
    roleLine?: string | null

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    languages?: string | null

    @Expose()
    @IsOptional()
    @IsBoolean()
    hasSetUsername?: boolean
}

@Exclude()
export class SetUsernameResponseDto {
    @Expose()
    @IsString()
    username: string

    @Expose()
    @IsBoolean()
    hasSetUsername: boolean
}

@Exclude()
export class UploadAvatarResponseDto {
    @Expose()
    @ApiProperty({ description: 'Presigned S3 GET URL (1-hour TTL)', nullable: true })
    @IsOptional()
    @IsString()
    avatarUrl: string | null

    @Expose()
    @IsOptional()
    @IsInt()
    @Min(1)
    width?: number

    @Expose()
    @IsOptional()
    @IsInt()
    @Min(1)
    height?: number

    @Expose()
    @ApiProperty({ description: 'ISO 8601 timestamp of the upload' })
    @IsString()
    uploadedAt: string
}
