export class GetThreadFilesQuery {
    constructor(
        public readonly viewerId: string,
        public readonly threadId: string
    ) {}
}
