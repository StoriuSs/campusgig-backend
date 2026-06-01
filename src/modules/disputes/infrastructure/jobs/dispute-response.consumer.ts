import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { Job } from 'bullmq'

import { ExpireDisputeResponseCommand } from '../../application/commands/expire-dispute-response'
import { DISPUTES_QUEUE } from './dispute-jobs.scheduler'

@Processor(DISPUTES_QUEUE)
export class DisputeResponseConsumer extends WorkerHost {
    private readonly logger = new Logger(DisputeResponseConsumer.name)

    constructor(private readonly commandBus: CommandBus) {
        super()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async process(job: Job<any, void, string>): Promise<void> {
        if (job.name === 'response-timeout') {
            const { disputeId } = job.data as { disputeId: string }
            await this.commandBus.execute(new ExpireDisputeResponseCommand(disputeId))
            return
        }
        this.logger.warn(`Unknown disputes-response job kind: ${job.name}`)
    }
}
