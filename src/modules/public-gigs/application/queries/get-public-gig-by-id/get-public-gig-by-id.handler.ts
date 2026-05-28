import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject, NotFoundException } from '@nestjs/common'
import { GetPublicGigByIdQuery } from './get-public-gig-by-id.query'
import {
    PublicGigsRepositoryPort,
    PUBLIC_GIGS_REPOSITORY_PORT,
    PublicGigDetail
} from '../../../domain/ports/public-gigs.repository.port'

@QueryHandler(GetPublicGigByIdQuery)
export class GetPublicGigByIdHandler implements IQueryHandler<GetPublicGigByIdQuery> {
    constructor(@Inject(PUBLIC_GIGS_REPOSITORY_PORT) private readonly repo: PublicGigsRepositoryPort) {}

    async execute(query: GetPublicGigByIdQuery): Promise<PublicGigDetail> {
        const detail = await this.repo.findById(query.id, query.userId)
        if (!detail) throw new NotFoundException('Gig not found or not available.')
        return detail
    }
}
