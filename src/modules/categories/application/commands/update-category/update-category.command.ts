export class UpdateCategoryCommand {
    constructor(
        public readonly id: string,
        public readonly name: string | undefined,
        public readonly icon: string | undefined,
        public readonly description: string | null | undefined,
        public readonly actorId: string
    ) {}
}
