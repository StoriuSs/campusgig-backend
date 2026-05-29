import type { MessageItem } from '../ports/messaging.repository.port'

export class MessageSentEvent {
    constructor(
        public readonly threadId: string,
        public readonly message: MessageItem,
        public readonly recipientId: string
    ) {}
}
