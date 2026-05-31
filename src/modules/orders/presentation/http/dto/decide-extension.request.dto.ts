import { IsIn } from 'class-validator'

const DECISIONS = ['accept', 'reject'] as const

export class DecideExtensionRequestDto {
    @IsIn(DECISIONS) decision!: (typeof DECISIONS)[number]
}
