/**
 * UpdateProfileCommand
 *
 * Command to update a user's profile fields (displayName, bio, location,
 * roleLine, languages). Avatar uploads are handled separately via
 * UploadAvatarCommand.
 */
export class UpdateProfileCommand {
    constructor(
        public readonly userId: string,
        public readonly displayName?: string,
        public readonly bio?: string,
        public readonly location?: string,
        public readonly roleLine?: string,
        public readonly languages?: string
    ) {}
}
