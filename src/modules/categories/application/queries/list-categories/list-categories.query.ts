export class ListCategoriesQuery {
    constructor(
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
