import { GigEntity, GigImageEntity, GigBulletEntity, GigFaqEntity, GigStatus } from '@/modules/gigs/domain'
import { Gig, GigImage, GigBullet, GigFaq } from '@/generated/prisma/client'

export class GigMapper {
    static toDomain(row: Gig): GigEntity {
        return new GigEntity({
            id: row.id,
            sellerId: row.sellerId,
            categoryId: row.categoryId,
            title: row.title,
            description: row.description,
            priceVnd: row.priceVnd,
            deliveryDays: row.deliveryDays,
            status: row.status as GigStatus,
            rejectionCategory: row.rejectionCategory,
            rejectionReason: row.rejectionReason,
            coverImageId: row.coverImageId,
            submittedAt: row.submittedAt,
            approvedAt: row.approvedAt,
            pausedAt: row.pausedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
            deletedBy: row.deletedBy
        })
    }
}

export class GigImageMapper {
    static toDomain(row: GigImage): GigImageEntity {
        return new GigImageEntity({
            id: row.id,
            gigId: row.gigId,
            imageKey: row.imageKey,
            width: row.width,
            height: row.height,
            position: row.position,
            uploaderId: row.uploaderId,
            createdAt: row.createdAt
        })
    }
}

export class GigBulletMapper {
    static toDomain(row: GigBullet): GigBulletEntity {
        return new GigBulletEntity({
            id: row.id,
            gigId: row.gigId,
            text: row.text,
            position: row.position
        })
    }
}

export class GigFaqMapper {
    static toDomain(row: GigFaq): GigFaqEntity {
        return new GigFaqEntity({
            id: row.id,
            gigId: row.gigId,
            question: row.question,
            answer: row.answer,
            position: row.position
        })
    }
}
