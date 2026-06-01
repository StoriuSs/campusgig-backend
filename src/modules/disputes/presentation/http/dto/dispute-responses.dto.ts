import { Exclude, Expose } from 'class-transformer'
import { IsInt, IsString, Min } from 'class-validator'

@Exclude()
export class StagedEvidenceResponseDto {
    @Expose() @IsString() id!: string
    @Expose() @IsString() side!: string
    @Expose() @IsString() name!: string
    @Expose() @IsInt() @Min(0) size!: number
    @Expose() @IsString() mime!: string
    @Expose() @IsString() createdAt!: string
}

@Exclude()
export class EvidenceUrlResponseDto {
    @Expose() @IsString() url!: string
}
