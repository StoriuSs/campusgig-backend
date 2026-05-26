import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

/**
 * HTTP Request DTO for updating user profile.
 * class-validator decorators apply here (presentation concern).
 *
 * Limits match spec § Validation rules:
 *   displayName 2-50 (only enforced when present)
 *   bio         0-1000
 *   roleLine    0-100
 *   location    0-100
 *   languages   0-200
 */
export class UpdateProfileRequestDto {
    @IsString()
    @IsOptional()
    @MinLength(2)
    @MaxLength(50)
    displayName?: string

    @IsString()
    @IsOptional()
    @MaxLength(1000)
    bio?: string

    @IsString()
    @IsOptional()
    @MaxLength(100)
    roleLine?: string

    @IsString()
    @IsOptional()
    @MaxLength(100)
    location?: string

    @IsString()
    @IsOptional()
    @MaxLength(200)
    languages?: string
}
