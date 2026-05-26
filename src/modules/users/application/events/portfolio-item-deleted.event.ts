/**
 * Published after a PortfolioItem row is deleted from the DB.
 * Subscribed by CleanupPortfolioImageHandler, which deletes the corresponding
 * S3 object. Same fire-and-forget pattern as AvatarUploadedEvent → CleanupOldAvatarHandler.
 */
export class PortfolioItemDeletedEvent {
    constructor(
        public readonly userId: string,
        public readonly imageKey: string
    ) {}
}
