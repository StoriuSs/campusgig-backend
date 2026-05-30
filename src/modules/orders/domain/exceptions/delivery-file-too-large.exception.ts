export class DeliveryFileTooLargeException extends Error {
    constructor(
        public readonly size: number,
        public readonly max: number
    ) {
        super(`Delivery file too large: ${size} bytes, max ${max} bytes`)
        this.name = 'DeliveryFileTooLargeException'
    }
}
