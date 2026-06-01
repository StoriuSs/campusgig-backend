import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/shared/infrastructure'
import {
    CategoryRepositoryPort,
    CategoryEntity,
    CategoryListResult,
    CategoryListItem
} from '@/modules/categories/domain'
import { CategoryMapper } from '../mappers/category.mapper'

/**
 * Prisma adapter for the Category aggregate. Hides Prisma-specific
 * details (case-insensitive lookups via `mode: 'insensitive'`, pagination
 * via skip/take, etc.) from the application layer.
 */
@Injectable()
export class PrismaCategoryRepository implements CategoryRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: {
        name: string
        icon: string
        description: string | null
        createdById: string | null
    }): Promise<CategoryEntity> {
        const row = await this.prisma.category.create({
            data: {
                name: data.name,
                icon: data.icon,
                description: data.description ?? undefined,
                createdById: data.createdById ?? undefined
            }
        })
        return CategoryMapper.toDomain(row)
    }

    async findById(id: string): Promise<CategoryEntity | null> {
        const row = await this.prisma.category.findUnique({ where: { id } })
        return row ? CategoryMapper.toDomain(row) : null
    }

    async findByNameInsensitive(name: string): Promise<CategoryEntity | null> {
        const row = await this.prisma.category.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        })
        return row ? CategoryMapper.toDomain(row) : null
    }

    async update(
        id: string,
        patch: { name?: string; icon?: string; description?: string | null }
    ): Promise<CategoryEntity> {
        const row = await this.prisma.category.update({
            where: { id },
            data: {
                ...(patch.name !== undefined ? { name: patch.name } : {}),
                ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {})
            }
        })
        return CategoryMapper.toDomain(row)
    }

    async delete(id: string): Promise<void> {
        await this.prisma.category.delete({ where: { id } })
    }

    async listPaginated(opts: { page: number; pageSize: number }): Promise<CategoryListResult> {
        const { page, pageSize } = opts
        const skip = (page - 1) * pageSize

        const [rows, total] = await this.prisma.$transaction([
            this.prisma.category.findMany({
                orderBy: { name: 'asc' },
                skip,
                take: pageSize
            }),
            this.prisma.category.count()
        ])

        const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const items: CategoryListItem[] = await Promise.all(
            rows.map(async (row) => {
                const [gigCount, orders30d] = await Promise.all([
                    this.prisma.gig.count({ where: { categoryId: row.id, deletedAt: null } }),
                    this.prisma.order.count({ where: { gig: { categoryId: row.id }, placedAt: { gte: since30d } } })
                ])
                return { category: CategoryMapper.toDomain(row), gigCount, orders30d }
            })
        )

        return { items, total }
    }

    async findAll(): Promise<CategoryEntity[]> {
        const rows = await this.prisma.category.findMany({ orderBy: { name: 'asc' } })
        return rows.map((row) => CategoryMapper.toDomain(row))
    }

    async countGigsForCategory(categoryId: string): Promise<number> {
        return this.prisma.gig.count({ where: { categoryId, deletedAt: null } })
    }

    async bulkReassignGigs(fromCategoryId: string, toCategoryId: string): Promise<void> {
        // Move every gig (incl. soft-deleted) so the category's hard delete can't
        // trip the required-relation foreign key.
        await this.prisma.gig.updateMany({
            where: { categoryId: fromCategoryId },
            data: { categoryId: toCategoryId }
        })
    }

    async findAllWithGigCount(): Promise<Array<CategoryEntity & { activeGigCount: number }>> {
        const rows = await this.prisma.category.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        gigs: { where: { status: 'Active', deletedAt: null } }
                    }
                }
            }
        })
        return rows.map((row) => ({
            ...CategoryMapper.toDomain(row),
            activeGigCount: row._count.gigs
        }))
    }
}
