import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, BadRequestException } from '@nestjs/common'
import { CreateGigCommand } from './create-gig.command'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    GigEntity,
    AdminCannotCreateGigException,
    GigImageCapReachedException,
    GigBulletCapReachedException,
    GigFaqCapReachedException,
    ImageNotOwnedException,
    CategoryNotFoundForGigException
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

@CommandHandler(CreateGigCommand)
export class CreateGigHandler implements ICommandHandler<CreateGigCommand> {
    constructor(
        @Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort,
        @Inject(CATEGORY_REPOSITORY_PORT) private readonly categoryRepo: CategoryRepositoryPort
    ) {}

    async execute(command: CreateGigCommand): Promise<GigEntity> {
        if (command.callerIsAdmin) {
            throw new AdminCannotCreateGigException()
        }

        const title = command.title.trim()
        if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
            throw new BadRequestException(`Title must be ${TITLE_MIN}-${TITLE_MAX} characters.`)
        }

        const description = command.description.trim()
        if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
            throw new BadRequestException(`Description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters.`)
        }

        if (!Number.isInteger(command.priceVnd) || command.priceVnd < PRICE_MIN || command.priceVnd > PRICE_MAX) {
            throw new BadRequestException(`Price must be an integer between ${PRICE_MIN} and ${PRICE_MAX} VND.`)
        }

        if (
            !Number.isInteger(command.deliveryDays) ||
            command.deliveryDays < DELIVERY_MIN ||
            command.deliveryDays > DELIVERY_MAX
        ) {
            throw new BadRequestException(`Delivery time must be ${DELIVERY_MIN}-${DELIVERY_MAX} days.`)
        }

        const category = await this.categoryRepo.findById(command.categoryId)
        if (!category) {
            throw new CategoryNotFoundForGigException(command.categoryId)
        }

        if (command.imageIds.length < MIN_IMAGES) {
            throw new BadRequestException('At least 1 image is required.')
        }
        if (command.imageIds.length > MAX_IMAGES) {
            throw new GigImageCapReachedException()
        }
        const seenIds = new Set<string>()
        for (const imageId of command.imageIds) {
            if (seenIds.has(imageId)) {
                throw new BadRequestException(`Duplicate image id: ${imageId}`)
            }
            seenIds.add(imageId)
            const image = await this.gigRepo.findImageById(imageId)
            if (!image || !image.isOrphan || image.uploaderId !== command.callerId) {
                throw new ImageNotOwnedException(imageId)
            }
        }

        if (command.bullets.length > MAX_BULLETS) {
            throw new GigBulletCapReachedException()
        }
        const trimmedBullets = command.bullets.map((b) => b.trim()).filter((b) => b.length > 0)
        for (const bullet of trimmedBullets) {
            if (bullet.length < BULLET_MIN || bullet.length > BULLET_MAX) {
                throw new BadRequestException(`Each bullet must be ${BULLET_MIN}-${BULLET_MAX} characters.`)
            }
        }

        if (command.faqs.length > MAX_FAQS) {
            throw new GigFaqCapReachedException()
        }
        const cleanFaqs = command.faqs.map((f) => ({
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

        return this.gigRepo.create(
            {
                sellerId: command.callerId,
                categoryId: command.categoryId,
                title,
                description,
                priceVnd: command.priceVnd,
                deliveryDays: command.deliveryDays,
                imageIds: command.imageIds,
                bullets: trimmedBullets,
                faqs: cleanFaqs
            },
            'Pending'
        )
    }
}
