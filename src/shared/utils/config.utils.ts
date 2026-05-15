/**
 * Safely parse integer from environment variable
 * @param value - Environment variable value (can be undefined)
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed integer or default value
 */
export function parseIntSafe(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? defaultValue : parsed
}
