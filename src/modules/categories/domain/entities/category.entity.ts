/**
 * Category Domain Entity. Pure domain — no framework, no ORM.
 */
export class CategoryEntity {
    readonly id: string
    name: string
    icon: string
    description: string | null
    readonly createdAt: Date
    updatedAt: Date
    createdById: string | null

    constructor(props: {
        id: string
        name: string
        icon: string
        description?: string | null
        createdAt?: Date
        updatedAt?: Date
        createdById?: string | null
    }) {
        this.id = props.id
        this.name = props.name
        this.icon = props.icon
        this.description = props.description ?? null
        this.createdAt = props.createdAt ?? new Date()
        this.updatedAt = props.updatedAt ?? new Date()
        this.createdById = props.createdById ?? null
    }
}
