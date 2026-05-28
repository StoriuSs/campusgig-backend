import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { GetWishlistQuery } from './get-wishlist.query'
import {
    WishlistRepositoryPort,
    WISHLIST_REPOSITORY_PORT,
    GetWishlistResult
} from '../../../domain/ports/wishlist.repository.port'

@QueryHandler(GetWishlistQuery)
export class GetWishlistHandler implements IQueryHandler<GetWishlistQuery> {
    constructor(@Inject(WISHLIST_REPOSITORY_PORT) private readonly repo: WishlistRepositoryPort) {}

    async execute(query: GetWishlistQuery): Promise<GetWishlistResult> {
        return this.repo.list(query.userId, query.page, query.pageSize)
    }
}
