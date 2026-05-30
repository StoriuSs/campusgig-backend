// System-driven: invoked by AcceptDeadlineJob when the 24h accept window
// passes with no seller action. No viewer arg — the actor is "the system".
export class AutoCancelOrderCommand {
    constructor(public readonly orderId: string) {}
}
