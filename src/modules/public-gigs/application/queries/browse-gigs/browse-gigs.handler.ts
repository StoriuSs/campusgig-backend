import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { BrowseGigsQuery } from './browse-gigs.query'
import {
    PublicGigsRepositoryPort,
    PUBLIC_GIGS_REPOSITORY_PORT,
    BrowseGigsResult
} from '../../../domain/ports/public-gigs.repository.port'

@QueryHandler(BrowseGigsQuery)
export class BrowseGigsHandler implements IQueryHandler<BrowseGigsQuery> {
    constructor(@Inject(PUBLIC_GIGS_REPOSITORY_PORT) private readonly repo: PublicGigsRepositoryPort) {}

    async execute(query: BrowseGigsQuery): Promise<BrowseGigsResult> {
        return this.repo.browse(query.filters)
    }
}
