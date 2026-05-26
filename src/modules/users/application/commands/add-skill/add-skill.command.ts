export class AddSkillCommand {
    constructor(
        public readonly userId: string,
        public readonly name: string
    ) {}
}
