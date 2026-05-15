/**
 * Generate a random numeric verification code
 * @param length - Number of digits (default: 6)
 * @returns String of random digits
 * @example
 * generateVerificationCode() // '123456'
 * generateVerificationCode(4) // '9876'
 */
export function generateVerificationCode(length: number = 6): string {
    const min = Math.pow(10, length - 1)
    const max = Math.pow(10, length) - 1
    return Math.floor(min + Math.random() * (max - min + 1)).toString()
}

/**
 * Generate a random alphanumeric code (uppercase)
 * @param length - Number of characters (default: 8)
 * @returns Random alphanumeric string
 * @example
 * generateAlphanumericCode() // 'A5B9C2X7'
 * generateAlphanumericCode(6) // 'XY4Z89'
 */
export function generateAlphanumericCode(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

/**
 * Generate a cryptographically secure random token
 * @param length - Number of bytes (default: 32)
 * @returns Hex string token
 * @example
 * generateSecureToken() // 'a1b2c3d4e5f6...'
 */
export function generateSecureToken(length: number = 32): string {
    const crypto = require('crypto')
    return crypto.randomBytes(length).toString('hex')
}
