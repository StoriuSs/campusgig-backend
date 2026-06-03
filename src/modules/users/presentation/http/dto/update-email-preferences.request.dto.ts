import { IsBoolean, IsOptional } from 'class-validator'

// Partial update — any subset of flags; omitted flags are left unchanged.
export class UpdateEmailPreferencesRequestDto {
    @IsBoolean()
    @IsOptional()
    emailNotificationsEnabled?: boolean

    @IsBoolean()
    @IsOptional()
    emailOrders?: boolean

    @IsBoolean()
    @IsOptional()
    emailDisputes?: boolean

    @IsBoolean()
    @IsOptional()
    emailGigs?: boolean
}
