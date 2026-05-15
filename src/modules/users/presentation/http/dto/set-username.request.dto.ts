import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator'

/**
 * HTTP Request DTO for setting username (one-time action)
 */
export class SetUsernameRequestDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(25)
    username: string
}
