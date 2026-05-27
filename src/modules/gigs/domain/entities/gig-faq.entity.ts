export class GigFaqEntity {
    readonly id: string
    gigId: string
    question: string
    answer: string
    position: number

    constructor(props: { id: string; gigId: string; question: string; answer: string; position: number }) {
        this.id = props.id
        this.gigId = props.gigId
        this.question = props.question
        this.answer = props.answer
        this.position = props.position
    }
}
