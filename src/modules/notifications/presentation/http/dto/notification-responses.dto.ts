import { Exclude, Expose, Transform, Type } from 'class-transformer'
import { IsArray, IsBoolean, IsInt, IsObject, IsString, Min, ValidateNested } from 'class-validator'

@Exclude()
export class NotificationRowDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() type!: string
    // Passthrough — without @Transform the serializer empties this blob to {}.
    @Expose() @Transform(({ obj }) => obj.data) @IsObject() data!: Record<string, unknown>
    @Expose() @IsBoolean() read!: boolean
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class NotificationListResponseDto {
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => NotificationRowDto) items!: NotificationRowDto[]
    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
}

@Exclude()
export class RecentNotificationsResponseDto {
    @Expose() @IsArray() @ValidateNested({ each: true }) @Type(() => NotificationRowDto) items!: NotificationRowDto[]
    @Expose() @IsInt() @Min(0) unreadCount!: number
}

@Exclude()
export class UnreadCountResponseDto {
    @Expose() @IsInt() @Min(0) count!: number
}
