import { BrowseGigsFilters } from '../../../domain/ports/public-gigs.repository.port'

export class BrowseGigsQuery {
    constructor(public readonly filters: BrowseGigsFilters) {}
}
