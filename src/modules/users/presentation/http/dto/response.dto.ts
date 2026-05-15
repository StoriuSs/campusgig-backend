import { Exclude, Expose } from 'class-transformer'
import { IsString, IsBoolean, IsOptional, IsArray, IsEmail, IsInt, Min, MaxLength } from 'class-validator'

// ============================================
// Response DTOs for HTTP endpoints
// ============================================

/**
 * User profile combining Keycloak token info + local DB preferences
 * Returned by GET /api/v1/users/me
 */
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
    @MaxLength(500)
    bio?: string

    @Expose()
    @IsOptional()
    @IsBoolean()
    hasSetUsername?: boolean
}

/**
 * Response for updateProfile endpoint
 */
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
    avatarUrl?: string

    @Expose()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    bio?: string

    @Expose()
    @IsOptional()
    @IsBoolean()
    hasSetUsername?: boolean
}

/**
 * Response for setUsername endpoint
 */
@Exclude()
export class SetUsernameResponseDto {
    @Expose()
    @IsString()
    username: string

    @Expose()
    @IsBoolean()
    hasSetUsername: boolean
}

/**
 * Response for uploadAvatar endpoint
 */
@Exclude()
export class UploadAvatarResponseDto {
    @Expose()
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
    @IsString()
    uploadedAt: string
}
