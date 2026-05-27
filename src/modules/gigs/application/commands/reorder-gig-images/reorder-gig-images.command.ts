export class ReorderGigImagesCommand {
    constructor(
        public readonly gigId: string,
        public readonly callerId: string,
        public readonly imageIds: string[]
    ) {}
}
