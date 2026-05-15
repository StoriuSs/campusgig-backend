/**
 * DeleteAccountCommand
 *
 * Command to soft-delete a user account and schedule Keycloak cleanup.
 */
export class DeleteAccountCommand {
    constructor(
        public readonly userId: string,
        public readonly actorId?: string
    ) {}
}
