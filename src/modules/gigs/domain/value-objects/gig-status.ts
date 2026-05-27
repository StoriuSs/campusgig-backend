/**
 * Gig lifecycle states. See spec § State machine.
 *
 * Transitions:
 *   Pending  → Active   (admin approves, Feature 05)
 *   Pending  → Rejected (admin rejects, Feature 05)
 *   Active   → Paused   (seller pauses)
 *   Paused   → Active   (seller resumes)
 *   Active   → Pending  (seller edits sensitive field)
 *   Paused   → Pending  (seller edits sensitive field)
 *   Rejected → Pending  (seller resubmits with any change)
 *   *        → Deleted  (seller soft-deletes; one-way)
 */
export const GIG_STATUSES = ['Pending', 'Active', 'Paused', 'Rejected', 'Deleted'] as const
export type GigStatus = (typeof GIG_STATUSES)[number]

/**
 * Fields that revert a gig to `Pending` review when edited from a
 * post-Pending state. Per SRS § I.3.
 *
 * Non-sensitive fields (`priceVnd`, `deliveryDays`) apply immediately and
 * keep the gig in its current state.
 */
export const SENSITIVE_FIELDS = ['title', 'categoryId', 'description', 'bullets', 'faqs', 'images'] as const
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number]

export const NON_SENSITIVE_FIELDS = ['priceVnd', 'deliveryDays'] as const
export type NonSensitiveField = (typeof NON_SENSITIVE_FIELDS)[number]

export type EditableField = SensitiveField | NonSensitiveField

export function isSensitiveField(field: string): field is SensitiveField {
    return (SENSITIVE_FIELDS as readonly string[]).includes(field)
}
