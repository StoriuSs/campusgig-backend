import { IsOptional, IsString } from 'class-validator'

/**
 * HTTP Request DTO for updating user profile
 * class-validator decorators apply here (presentation concern)
 */
export class UpdateProfileRequestDto {
    @IsString()
    @IsOptional()
    displayName?: string

    @IsString()
    @IsOptional()
    bio?: string
}
