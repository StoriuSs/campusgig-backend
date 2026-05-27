/**
 * Categories an admin must pick when rejecting a gig (Feature 05).
 * Per SRS § Admin Module § 2 (Gig Review Modal — Reject).
 *
 * Stored as the canonical English string; the frontend i18n-izes at display time.
 */
export const REJECTION_CATEGORIES = ['Pricing', 'Description', 'Image quality', 'Policy violation', 'Other'] as const
export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number]

export function isRejectionCategory(value: string): value is RejectionCategory {
    return (REJECTION_CATEGORIES as readonly string[]).includes(value)
}
