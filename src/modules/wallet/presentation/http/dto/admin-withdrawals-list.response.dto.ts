import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, Min, ValidateNested } from 'class-validator'
import { AdminWithdrawalRowDto } from './admin-withdrawal-row.response.dto'

@Exclude()
export class AdminWithdrawalsSummaryDto {
    @Expose() @IsInt() @Min(0) pendingCount!: number
    @Expose() @IsInt() @Min(0) processedThisMonthCount!: number
}

@Exclude()
export class AdminWithdrawalsListResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AdminWithdrawalRowDto)
    items!: AdminWithdrawalRowDto[]

    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
    @Expose() @ValidateNested() @Type(() => AdminWithdrawalsSummaryDto) summary!: AdminWithdrawalsSummaryDto
}
