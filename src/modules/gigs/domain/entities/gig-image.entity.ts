export class GigImageEntity {
    readonly id: string
    gigId: string | null
    imageKey: string
    width: number
    height: number
    position: number
    uploaderId: string
    readonly createdAt: Date

    constructor(props: {
        id: string
        gigId?: string | null
        imageKey: string
        width: number
        height: number
        position?: number
        uploaderId: string
        createdAt?: Date
    }) {
        this.id = props.id
        this.gigId = props.gigId ?? null
        this.imageKey = props.imageKey
        this.width = props.width
        this.height = props.height
        this.position = props.position ?? 0
        this.uploaderId = props.uploaderId
        this.createdAt = props.createdAt ?? new Date()
    }

    get isOrphan(): boolean {
        return this.gigId === null
    }
}
