import { IsIn, IsString, MaxLength, MinLength } from 'class-validator'
import { REJECTION_CATEGORIES } from '@/modules/gigs/domain'

export class RejectGigRequestDto {
    @IsIn(REJECTION_CATEGORIES as unknown as string[])
    rejectionCategory!: string

    @IsString()
    @MinLength(20)
    @MaxLength(1000)
    rejectionReason!: string
}
