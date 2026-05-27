export class GigBulletEntity {
    readonly id: string
    gigId: string
    text: string
    position: number

    constructor(props: { id: string; gigId: string; text: string; position: number }) {
        this.id = props.id
        this.gigId = props.gigId
        this.text = props.text
        this.position = props.position
    }
}
