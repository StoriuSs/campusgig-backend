export class CreateCategoryCommand {
    constructor(
        public readonly name: string,
        public readonly icon: string,
        public readonly description: string | null,
        public readonly actorId: string
    ) {}
}
