import { calculatePagination, getSkip, createPaginatedResponse } from './pagination.util'

describe('pagination.util', () => {
    describe('calculatePagination', () => {
        it('should calculate correct metadata for first page', () => {
            const result = calculatePagination(1, 10, 100)

            expect(result).toEqual({
                currentPage: 1,
                itemsPerPage: 10,
                totalItems: 100,
                totalPages: 10,
                hasNextPage: true,
                hasPreviousPage: false
            })
        })

        it('should calculate correct metadata for middle page', () => {
            const result = calculatePagination(5, 10, 100)

            expect(result).toEqual({
                currentPage: 5,
                itemsPerPage: 10,
                totalItems: 100,
                totalPages: 10,
                hasNextPage: true,
                hasPreviousPage: true
            })
        })

        it('should calculate correct metadata for last page', () => {
            const result = calculatePagination(10, 10, 100)

            expect(result).toEqual({
                currentPage: 10,
                itemsPerPage: 10,
                totalItems: 100,
                totalPages: 10,
                hasNextPage: false,
                hasPreviousPage: true
            })
        })

        it('should handle single page results', () => {
            const result = calculatePagination(1, 10, 5)

            expect(result.totalPages).toBe(1)
            expect(result.hasNextPage).toBe(false)
            expect(result.hasPreviousPage).toBe(false)
        })

        it('should handle empty results', () => {
            const result = calculatePagination(1, 10, 0)

            expect(result.totalPages).toBe(0)
            expect(result.totalItems).toBe(0)
            expect(result.hasNextPage).toBe(false)
        })

        it('should handle partial last page', () => {
            const result = calculatePagination(1, 10, 25)

            expect(result.totalPages).toBe(3) // ceil(25/10) = 3
        })
    })

    describe('getSkip', () => {
        it('should return 0 for first page', () => {
            expect(getSkip(1, 10)).toBe(0)
        })

        it('should return correct skip for second page', () => {
            expect(getSkip(2, 10)).toBe(10)
        })

        it('should return correct skip for arbitrary page', () => {
            expect(getSkip(5, 20)).toBe(80) // (5-1) * 20 = 80
        })
    })

    describe('createPaginatedResponse', () => {
        it('should create correct response structure', () => {
            const items = [{ id: 1 }, { id: 2 }]
            const result = createPaginatedResponse(items, 1, 10, 2)

            expect(result).toEqual({
                items,
                meta: {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalItems: 2,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            })
        })

        it('should handle empty items array', () => {
            const result = createPaginatedResponse([], 1, 10, 0)

            expect(result.items).toEqual([])
            expect(result.meta.totalItems).toBe(0)
        })
    })
})
