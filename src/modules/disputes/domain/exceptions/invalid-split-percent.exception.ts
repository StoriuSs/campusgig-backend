export class InvalidSplitPercentException extends Error {
    constructor(public readonly value: number | null | undefined) {
        super(`Split buyer-refund percent must be an integer 0–80, got ${value}`)
        this.name = 'InvalidSplitPercentException'
    }
}
