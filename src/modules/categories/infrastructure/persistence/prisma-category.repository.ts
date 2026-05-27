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

        // gigCount + orders30d are 0 in Feature 03 (no Gig/Order tables yet).
        // Feature 04+ will compute via Promise.all of count queries.
        const items: CategoryListItem[] = rows.map((row) => ({
            category: CategoryMapper.toDomain(row),
            gigCount: 0,
            orders30d: 0
        }))

        return { items, total }
    }

    async findAll(): Promise<CategoryEntity[]> {
        const rows = await this.prisma.category.findMany({ orderBy: { name: 'asc' } })
        return rows.map((row) => CategoryMapper.toDomain(row))
    }

    async countGigsForCategory(_categoryId: string): Promise<number> {
        // Feature 03 stub. Feature 04 will replace with:
        //   return this.prisma.gig.count({ where: { categoryId: _categoryId, deletedAt: null } })
        return 0
    }

    async bulkReassignGigs(_fromCategoryId: string, _toCategoryId: string): Promise<void> {
        // Feature 03 stub. Feature 04 will replace with:
        //   await this.prisma.gig.updateMany({ where: { categoryId: _fromCategoryId }, data: { categoryId: _toCategoryId } })
        return
    }
}
