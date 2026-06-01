export class SaveAdminNoteCommand {
    constructor(
        public readonly userId: string,
        public readonly adminId: string,
        public readonly note: string | null
    ) {}
}
