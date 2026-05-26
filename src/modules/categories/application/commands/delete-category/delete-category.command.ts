export class DeleteCategoryCommand {
    constructor(
        public readonly id: string,
        public readonly reassignTo: string | null,
        public readonly actorId: string
    ) {}
}
