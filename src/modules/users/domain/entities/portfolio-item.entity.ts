/**
 * PortfolioItem Domain Entity
 *
 * A portfolio image entry owned by a User. Stores the S3 object key, not a URL —
 * the controller resolves to a presigned GET URL on read. Pure data class with
 * no behavior beyond construction. Owned by the User aggregate (cascade on user delete).
 */
export class PortfolioItemEntity {
    readonly id: string
    readonly userId: string
    imageKey: string
    width: number
    height: number
    position: number
    readonly createdAt: Date

    constructor(props: {
        id: string
        userId: string
        imageKey: string
        width: number
        height: number
        position: number
        createdAt?: Date
    }) {
        this.id = props.id
        this.userId = props.userId
        this.imageKey = props.imageKey
        this.width = props.width
        this.height = props.height
        this.position = props.position
        this.createdAt = props.createdAt ?? new Date()
    }
}
