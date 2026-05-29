export class MarkThreadReadCommand {
    constructor(
        public readonly viewerId: string,
        public readonly threadId: string
    ) {}
}
