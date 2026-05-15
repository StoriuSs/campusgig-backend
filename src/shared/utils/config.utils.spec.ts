import { parseIntSafe } from './config.utils'

describe('config.utils', () => {
    describe('parseIntSafe', () => {
        it('should parse valid number string', () => {
            expect(parseIntSafe('42', 0)).toBe(42)
        })

        it('should parse negative numbers', () => {
            expect(parseIntSafe('-10', 0)).toBe(-10)
        })

        it('should return default for undefined', () => {
            expect(parseIntSafe(undefined, 10)).toBe(10)
        })

        it('should return default for empty string', () => {
            expect(parseIntSafe('', 5)).toBe(5)
        })

        it('should return default for non-numeric string', () => {
            expect(parseIntSafe('abc', 100)).toBe(100)
        })

        it('should return default for NaN result', () => {
            expect(parseIntSafe('NaN', 50)).toBe(50)
        })

        it('should handle zero as valid value', () => {
            expect(parseIntSafe('0', 99)).toBe(0)
        })

        it('should handle floating point strings (truncates)', () => {
            expect(parseIntSafe('3.14', 0)).toBe(3)
        })
    })
})
