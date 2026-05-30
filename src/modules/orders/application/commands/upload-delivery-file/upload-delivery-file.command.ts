export class UploadDeliveryFileCommand {
    constructor(
        public readonly viewerId: string, // must be the seller of the order
        public readonly orderId: string,
        public readonly filename: string,
        public readonly mime: string,
        public readonly body: Buffer
    ) {}
}
