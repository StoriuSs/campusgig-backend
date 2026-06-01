import { CategoryEntity } from '../entities/category.entity'

export const CATEGORY_REPOSITORY_PORT = 'CATEGORY_REPOSITORY_PORT'

export interface CategoryListItem {
    category: CategoryEntity
    gigCount: number
    orders30d: number
}

export interface CategoryListResult {
    items: CategoryListItem[]
    total: number
}

export interface CategoryRepositoryPort {
    create(data: {
        name: string
        icon: string
        description: string | null
        createdById: string | null
    }): Promise<CategoryEntity>

    findById(id: string): Promise<CategoryEntity | null>

    findByNameInsensitive(name: string): Promise<CategoryEntity | null>

    update(id: string, patch: { name?: string; icon?: string; description?: string | null }): Promise<CategoryEntity>

    delete(id: string): Promise<void>

    listPaginated(opts: { page: number; pageSize: number }): Promise<CategoryListResult>

    /**
     * All categories, alphabetical, no pagination, no derived counts.
     * Used by the public read endpoint (consumed by sellers in Feature 04
     * Create Gig dropdown and by buyers in Feature 06 Browse).
     */
    findAll(): Promise<CategoryEntity[]>

    /**
     * All categories with the count of Active (non-deleted) gigs per category.
     * Used by Feature 06 public categories list and Browse categories page.
     */
    findAllWithGigCount(): Promise<Array<CategoryEntity & { activeGigCount: number }>>

    /**
     * Count gigs assigned to a given category. Returns 0 in Feature 03 because
     * the Gig table doesn't exist yet — implementation can defensively return
     * 0 until Feature 04 wires this against the real `gig` model.
     */
    countGigsForCategory(categoryId: string): Promise<number>

    /**
     * Reassign all gigs from `fromCategoryId` to `toCategoryId`. No-op in
     * Feature 03 (no Gig table). Feature 04 will implement.
     */
    bulkReassignGigs(fromCategoryId: string, toCategoryId: string): Promise<void>

    /**
     * Id of any other category (alphabetical), or null if none exists. Used to
     * rehome soft-deleted gigs that still FK-reference a category being deleted
     * (they're invisible but keep the required relation alive for order history).
     */
    findFallbackCategoryId(excludeId: string): Promise<string | null>
}
