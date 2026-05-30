import type { OrderStatus } from '../ports/orders.repository.port'

export class InvalidTransitionException extends Error {
    constructor(
        public readonly currentStatus: OrderStatus,
        public readonly attemptedTransition: string
    ) {
        super(`Cannot ${attemptedTransition} from status ${currentStatus}`)
        this.name = 'InvalidTransitionException'
    }
}
