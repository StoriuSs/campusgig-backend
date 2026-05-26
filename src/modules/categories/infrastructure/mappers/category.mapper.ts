import { CategoryEntity } from '@/modules/categories/domain'
import { Category } from '@/generated/prisma/client'

export class CategoryMapper {
    static toDomain(row: Category): CategoryEntity {
        return new CategoryEntity({
            id: row.id,
            name: row.name,
            icon: row.icon,
            description: row.description,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            createdById: row.createdById
        })
    }
}
