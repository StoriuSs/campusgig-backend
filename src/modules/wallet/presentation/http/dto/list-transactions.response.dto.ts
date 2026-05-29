import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, Min, ValidateNested } from 'class-validator'
import { TransactionItemDto } from './transaction-item.response.dto'

@Exclude()
export class ListTransactionsResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TransactionItemDto)
    items!: TransactionItemDto[]

    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
}
