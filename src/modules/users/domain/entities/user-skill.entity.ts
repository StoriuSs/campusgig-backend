/**
 * UserSkill Domain Entity
 *
 * A free-form skill string owned by a User. Pure data — no behavior beyond
 * construction. Owned by the User aggregate (cascade on user delete).
 */
export class UserSkillEntity {
    readonly id: string
    readonly userId: string
    name: string
    position: number
    readonly createdAt: Date

    constructor(props: { id: string; userId: string; name: string; position: number; createdAt?: Date }) {
        this.id = props.id
        this.userId = props.userId
        this.name = props.name
        this.position = props.position
        this.createdAt = props.createdAt ?? new Date()
    }
}
