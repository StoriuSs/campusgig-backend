export class DeleteGigImageCommand {
    constructor(
        public readonly imageId: string,
        public readonly callerId: string
    ) {}
}
