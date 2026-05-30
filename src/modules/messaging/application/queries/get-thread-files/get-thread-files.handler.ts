import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import { MESSAGING_REPOSITORY_PORT, MessagingRepositoryPort, FileItem } from '../../../domain/ports'
import { NotAThreadParticipantException } from '../../../domain/exceptions'
import { GetThreadFilesQuery } from './get-thread-files.query'

@QueryHandler(GetThreadFilesQuery)
export class GetThreadFilesHandler implements IQueryHandler<GetThreadFilesQuery> {
    constructor(
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly repo: MessagingRepositoryPort
    ) {}

    async execute(query: GetThreadFilesQuery): Promise<FileItem[]> {
        const thread = await this.repo.getThreadById(query.threadId, query.viewerId)
        if (!thread) {
            throw new NotAThreadParticipantException(query.threadId, query.viewerId)
        }
        return this.repo.listThreadFiles(query.threadId, query.viewerId, {
            orderId: query.orderId ?? undefined
        })
    }
}
