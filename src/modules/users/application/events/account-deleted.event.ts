/**
 * Domain Event: Account Deleted
 *
 * Published when a user account is soft-deleted.
 * Event handlers react to this for cache invalidation and Keycloak hard delete.
 */
export class AccountDeletedEvent {
    constructor(
        public readonly userId: string,
        public readonly keycloakId: string
    ) {}
}
