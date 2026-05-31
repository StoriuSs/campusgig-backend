export class ReviewNotFoundException extends Error {
    constructor(public readonly reviewId: string) {
        super(`Review ${reviewId} not found`)
        this.name = 'ReviewNotFoundException'
    }
}

export class ReviewAlreadyExistsException extends Error {
    constructor(public readonly orderId: string) {
        super(`Order ${orderId} already has a review`)
        this.name = 'ReviewAlreadyExistsException'
    }
}

export class OrderNotCompletedException extends Error {
    constructor(public readonly orderId: string) {
        super(`Order ${orderId} is not Completed; cannot review`)
        this.name = 'OrderNotCompletedException'
    }
}

export class NotTheBuyerException extends Error {
    constructor(public readonly orderId: string) {
        super(`Only the buyer can review order ${orderId}`)
        this.name = 'NotTheBuyerException'
    }
}

export class ReplyAlreadyExistsException extends Error {
    constructor(public readonly reviewId: string) {
        super(`Review ${reviewId} already has a reply`)
        this.name = 'ReplyAlreadyExistsException'
    }
}

export class GigNotActiveForReplyException extends Error {
    constructor(public readonly reviewId: string) {
        super(`Cannot reply to review ${reviewId}: gig is not Active`)
        this.name = 'GigNotActiveForReplyException'
    }
}

export class NotTheSellerException extends Error {
    constructor(public readonly reviewId: string) {
        super(`Only the gig's seller can reply to review ${reviewId}`)
        this.name = 'NotTheSellerException'
    }
}
