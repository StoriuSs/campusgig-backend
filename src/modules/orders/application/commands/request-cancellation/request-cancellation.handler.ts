import { BadRequestException, Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import {
    CancellationItem,
    CancellationReasonCode,
    OrderDetail,
    ORDERS_REPOSITORY_PORT,
    OrdersRepositoryPort
} from '../../../domain/ports'
import { CancellationRequestedEvent } from '../../../domain/events'
import { RequestCancellationCommand } from './request-cancellation.command'

const BUYER_REASONS: CancellationReasonCode[] = [
    'BuyerSituationChanged',
    'BuyerOrderedByMistake',
    'BuyerAgreedInChat',
    'BuyerOther'
]
const SELLER_REASONS: CancellationReasonCode[] = [
    'SellerScheduleConflict',
    'SellerRequirementsMismatch',
    'SellerAgreedInChat',
    'SellerOther'
]
const ALL_REASONS = [...BUYER_REASONS, ...SELLER_REASONS]
const MAX_OTHER_TEXT_LENGTH = 500

@CommandHandler(RequestCancellationCommand)
export class RequestCancellationHandler implements ICommandHandler<RequestCancellationCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: RequestCancellationCommand): Promise<OrderDetail> {
        if (!ALL_REASONS.includes(command.reasonCode)) {
            throw new BadRequestException(`Unknown cancellation reasonCode: ${command.reasonCode}`)
        }

        const requiresOther = command.reasonCode === 'BuyerOther' || command.reasonCode === 'SellerOther'
        const otherText = command.otherText?.trim() || null
        if (requiresOther && (!otherText || otherText.length === 0)) {
            throw new BadRequestException(`otherText is required when reasonCode is ${command.reasonCode}`)
        }
        if (otherText && otherText.length > MAX_OTHER_TEXT_LENGTH) {
            throw new BadRequestException(`otherText must be ${MAX_OTHER_TEXT_LENGTH} characters or fewer`)
        }

        const result: { order: OrderDetail; cancellation: CancellationItem } = await this.repo.requestCancellation({
            orderId: command.orderId,
            viewerId: command.viewerId,
            reasonCode: command.reasonCode,
            otherText
        })

        this.eventBus.publish(new CancellationRequestedEvent(result.order, result.cancellation, command.viewerId))
        return result.order
    }
}
