import { PaginatedResponse, PaginationMeta, createPaginatedResponse as createPagination } from '@/shared/utils'

/**
 * Type for what services return BEFORE TransformInterceptor processes it.
 * The interceptor transforms this into ApiResponse<T> with { meta, data } structure.
 *
 * @example
 * // Service method with type-safe return
 * async updateProfile(id: string, dto: UpdateDto): Promise<ServiceResponse<UserDto>> {
 *     const user = await this.repo.update(id, dto)
 *     return createResponse(
 *         RESPONSE_CODES.USER_UPDATE_SUCCESS,
 *         RESPONSE_TYPES.USER_UPDATE,
 *         MESSAGES.USER.PROFILE_UPDATED,
 *         serialize(UserDto, user)
 *     )
 * }
 */
export interface ServiceResponse<T = unknown> {
    code: string
    type: string
    message: string
    data: T
}

/**
 * Type-safe builder function for service responses.
 * Ensures all required fields are present and data matches the expected type.
 *
 * @param code - Response code from RESPONSE_CODES constant
 * @param type - Response type from RESPONSE_TYPES constant
 * @param message - Human-readable message
 * @param data - Response payload (type-checked)
 * @returns ServiceResponse<T> that TransformInterceptor will wrap in { meta, data }
 */
export function createResponse<T>(code: string, type: string, message: string, data: T): ServiceResponse<T> {
    return { code, type, message, data }
}

/**
 * Paginated service response type using existing pagination utilities.
 * Uses PaginatedResponse from pagination.util.ts to avoid duplication.
 *
 * @example
 * async getUsers(query: PaginationQueryDto): Promise<PaginatedServiceResponse<UserDto>> {
 *     const [items, total] = await this.repo.findAndCount(query)
 *     return createPaginatedServiceResponse(
 *         RESPONSE_CODES.SUCCESS,
 *         RESPONSE_TYPES.SUCCESS,
 *         'Users fetched successfully',
 *         items,
 *         query.page,
 *         query.limit,
 *         total
 *     )
 * }
 */
export type PaginatedServiceResponse<T> = ServiceResponse<PaginatedResponse<T>>

/**
 * Helper to create paginated responses with type safety.
 * Wraps the existing createPaginatedResponse from pagination.util.ts.
 *
 * @param code - Response code
 * @param type - Response type
 * @param message - Human-readable message
 * @param items - Array of items for current page
 * @param page - Current page number
 * @param limit - Items per page
 * @param totalItems - Total count of all items
 * @returns PaginatedServiceResponse<T>
 */
export function createPaginatedServiceResponse<T>(
    code: string,
    type: string,
    message: string,
    items: T[],
    page: number,
    limit: number,
    totalItems: number
): PaginatedServiceResponse<T> {
    // Use existing pagination utility
    const paginatedData = createPagination(items, page, limit, totalItems)

    return {
        code,
        type,
        message,
        data: paginatedData
    }
}

// Re-export pagination types for convenience
export { PaginatedResponse, PaginationMeta }
