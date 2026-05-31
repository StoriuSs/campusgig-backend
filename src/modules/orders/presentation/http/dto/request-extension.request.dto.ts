import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

const HOUR_OPTIONS = [12, 24, 48, 72] as const

export class RequestExtensionRequestDto {
    // Matches the M1 modal's four radio buttons. Validated strictly so the
    // API can't be used to request 5h or 200h.
    @IsIn(HOUR_OPTIONS) hoursRequested!: (typeof HOUR_OPTIONS)[number]

    // Optional 500-char justification ("What changed in v2?"-style copy in
    // the M1 textarea). The chat carries any follow-up.
    @IsOptional() @IsString() @MaxLength(500) reason?: string
}
