export class UpdateEmailPreferencesCommand {
    constructor(
        public readonly userId: string,
        public readonly prefs: {
            emailNotificationsEnabled?: boolean
            emailOrders?: boolean
            emailDisputes?: boolean
            emailGigs?: boolean
        }
    ) {}
}
