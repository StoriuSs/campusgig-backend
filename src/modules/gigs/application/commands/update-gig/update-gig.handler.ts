import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, BadRequestException } from '@nestjs/common'
import { UpdateGigCommand } from './update-gig.command'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigNotFoundException,
    GigImageCapReachedException,
    GigBulletCapReachedException,
    GigFaqCapReachedException,
    ImageNotOwnedException,
    CategoryNotFoundForGigException,
    GigLockedForReviewException,
    GigStatus,
    isSensitiveChange
} from '@/modules/gigs/domain'
import { CategoryRepositoryPort, CATEGORY_REPOSITORY_PORT } from '@/modules/categories/domain'

const TITLE_MIN = 10
const TITLE_MAX = 100
const DESCRIPTION_MIN = 30
const DESCRIPTION_MAX = 5000
const PRICE_MIN = 10_000
const PRICE_MAX = 50_000_000
const DELIVERY_MIN = 1
const DELIVERY_MAX = 30
const MAX_IMAGES = 10
const MIN_IMAGES = 1
const MAX_BULLETS = 5
const BULLET_MIN = 5
const BULLET_MAX = 80
const MAX_FAQS = 5
const FAQ_Q_MIN = 5
const FAQ_Q_MAX = 120
const FAQ_A_MIN = 10
const FAQ_A_MAX = 500

export interface UpdateGigResult {
    gig: GigEntity
    statusChanged: boolean
    previousStatus: GigStatus
    newStatus: GigStatus
}

@CommandHandler(UpdateGigCommand)
export class UpdateGigHandler implements ICommandHandler<UpdateGigCommand> {
    constructor(
        @Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort,
        @Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort
    ) {}

    async execute(command: UpdateGigCommand): Promise<UpdateGigResult> {
        const current = await this.gigRepo.findByIdWithRelations(command.gigId)
        if (!current || current.gig.sellerId !== command.callerId || current.gig.isDeleted) {
            throw new GigNotFoundException(command.gigId)
        }

        if (current.gig.status === 'Pending') {
            throw new GigLockedForReviewException(command.gigId)
        }

        const patch = command.patch

        if (patch.title !== undefined) {
            const t = patch.title.trim()
            if (t.length < TITLE_MIN || t.length > TITLE_MAX) {
                throw new BadRequestException(`Title must be ${TITLE_MIN}-${TITLE_MAX} characters.`)
            }
            patch.title = t
        }
        if (patch.description !== undefined) {
            const d = patch.description.trim()
            if (d.length < DESCRIPTION_MIN || d.length > DESCRIPTION_MAX) {
                throw new BadRequestException(`Description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters.`)
            }
            patch.description = d
        }
        if (patch.priceVnd !== undefined) {
            if (!Number.isInteger(patch.priceVnd) || patch.priceVnd < PRICE_MIN || patch.priceVnd > PRICE_MAX) {
                throw new BadRequestException(`Price must be an integer between ${PRICE_MIN} and ${PRICE_MAX} VND.`)
            }
        }
        if (patch.deliveryDays !== undefined) {
            if (
                !Number.isInteger(patch.deliveryDays) ||
                patch.deliveryDays < DELIVERY_MIN ||
                patch.deliveryDays > DELIVERY_MAX
            ) {
                throw new BadRequestException(`Delivery time must be ${DELIVERY_MIN}-${DELIVERY_MAX} days.`)
            }
        }
        if (patch.categoryId !== undefined && patch.categoryId !== current.gig.categoryId) {
            const category = await this.categoryRepo.findById(patch.categoryId)
            if (!category) {
                throw new CategoryNotFoundForGigException(patch.categoryId)
            }
        }
        if (patch.bullets !== undefined) {
            if (patch.bullets.length > MAX_BULLETS) {
                throw new GigBulletCapReachedException()
            }
            const trimmed = patch.bullets.map((b) => b.trim()).filter((b) => b.length > 0)
            for (const bullet of trimmed) {
                if (bullet.length < BULLET_MIN || bullet.length > BULLET_MAX) {
                    throw new BadRequestException(`Each bullet must be ${BULLET_MIN}-${BULLET_MAX} characters.`)
                }
            }
            patch.bullets = trimmed
        }
        if (patch.faqs !== undefined) {
            if (patch.faqs.length > MAX_FAQS) {
                throw new GigFaqCapReachedException()
            }
            const cleanFaqs = patch.faqs.map((f) => ({
                question: f.question.trim(),
                answer: f.answer.trim()
            }))
            for (const faq of cleanFaqs) {
                if (faq.question.length < FAQ_Q_MIN || faq.question.length > FAQ_Q_MAX) {
                    throw new BadRequestException(`Each FAQ question must be ${FAQ_Q_MIN}-${FAQ_Q_MAX} characters.`)
                }
                if (faq.answer.length < FAQ_A_MIN || faq.answer.length > FAQ_A_MAX) {
                    throw new BadRequestException(`Each FAQ answer must be ${FAQ_A_MIN}-${FAQ_A_MAX} characters.`)
                }
            }
            patch.faqs = cleanFaqs
        }
        if (patch.imageIds !== undefined) {
            if (patch.imageIds.length < MIN_IMAGES) {
                throw new BadRequestException('At least 1 image is required.')
            }
            if (patch.imageIds.length > MAX_IMAGES) {
                throw new GigImageCapReachedException()
            }
            const seenIds = new Set<string>()
            for (const imageId of patch.imageIds) {
                if (seenIds.has(imageId)) {
                    throw new BadRequestException(`Duplicate image id: ${imageId}`)
                }
                seenIds.add(imageId)
                const image = await this.gigRepo.findImageById(imageId)
                if (!image) {
                    throw new ImageNotOwnedException(imageId)
                }
                if (image.gigId === current.gig.id) {
                    continue
                }
                if (image.isOrphan && image.uploaderId === command.callerId) {
                    continue
                }
                throw new ImageNotOwnedException(imageId)
            }
        }

        // Sensitive changes (title/price/desc/category) re-queue for moderation.
        // Any edit on a Rejected gig also re-queues (counts as resubmission).
        const sensitive = isSensitiveChange(current, patch)
        const previousStatus = current.gig.status
        let nextStatus: GigStatus | null = null

        if (sensitive) {
            if (previousStatus === 'Active' || previousStatus === 'Paused' || previousStatus === 'Rejected') {
                nextStatus = 'Pending'
            }
        } else {
            if (previousStatus === 'Rejected' && Object.keys(patch).length > 0) {
                nextStatus = 'Pending'
            }
        }

        const updated = await this.gigRepo.update(command.gigId, patch, nextStatus)

        return {
            gig: updated,
            statusChanged: nextStatus !== null,
            previousStatus,
            newStatus: updated.status
        }
    }
}
