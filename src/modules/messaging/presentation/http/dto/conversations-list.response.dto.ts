import { Exclude, Expose, Type } from 'class-transformer'
import { IsArray, IsInt, Min, ValidateNested } from 'class-validator'
import { ConversationItemResponseDto } from './conversation-item.response.dto'

@Exclude()
export class ConversationsListResponseDto {
    @Expose()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ConversationItemResponseDto)
    items!: ConversationItemResponseDto[]

    @Expose() @IsInt() @Min(0) total!: number
    @Expose() @IsInt() @Min(1) page!: number
    @Expose() @IsInt() @Min(1) pageSize!: number
}
