import { IsString, MaxLength, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'

/**
 * HTTP Request DTO for adding a skill (POST /users/me/skills).
 * Empty/whitespace strings are rejected by MinLength after the Transform trims.
 */
export class AddSkillRequestDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @MinLength(1)
    @MaxLength(30)
    name!: string
}
