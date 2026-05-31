import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { RecordGigViewCommand } from './record-gig-view.command'
import {
    PublicGigsRepositoryPort,
    PUBLIC_GIGS_REPOSITORY_PORT
} from '../../../domain/ports/public-gigs.repository.port'

@CommandHandler(RecordGigViewCommand)
export class RecordGigViewHandler implements ICommandHandler<RecordGigViewCommand> {
    constructor(@Inject(PUBLIC_GIGS_REPOSITORY_PORT) private readonly repo: PublicGigsRepositoryPort) {}

    async execute(command: RecordGigViewCommand): Promise<void> {
        await this.repo.recordView(command.gigId)
    }
}
