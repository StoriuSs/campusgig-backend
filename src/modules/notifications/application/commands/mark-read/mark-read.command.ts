export class MarkReadCommand {
    constructor(
        public readonly id: string,
        public readonly recipientId: string
    ) {}
}
