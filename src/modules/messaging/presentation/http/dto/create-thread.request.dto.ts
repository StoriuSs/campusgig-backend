import { Exclude, Expose } from 'class-transformer'
import { IsString, IsUUID } from 'class-validator'

@Exclude()
export class CreateThreadRequestDto {
    @Expose() @IsString() @IsUUID() otherUserId!: string
}
