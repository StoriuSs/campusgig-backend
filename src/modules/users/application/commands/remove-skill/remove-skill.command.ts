export class RemoveSkillCommand {
    constructor(
        public readonly userId: string,
        public readonly skillId: string
    ) {}
}
