/**
 * Generic context for email templates
 * Extend this interface for specific email template contexts
 */
export interface EmailContext {
    [key: string]: string | number | boolean | undefined | null
}

/**
 * Context for verification code email
 */
export interface VerificationCodeEmailContext extends EmailContext {
    code: string
    appName: string
    expiresIn: number
    fullName?: string
}
