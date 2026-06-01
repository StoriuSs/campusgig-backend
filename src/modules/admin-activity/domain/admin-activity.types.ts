// The granular action recorded per admin mutation. The Activity Log toolbar
// filters by coarser groups (see AdminActivityFilter).
export type AdminActionType =
    | 'gig_approved'
    | 'gig_rejected'
    | 'dispute_resolved'
    | 'withdrawal_processed'
    | 'withdrawal_rejected'
    | 'user_endorsed'
    | 'endorsement_revoked'
    | 'category_created'
    | 'category_edited'
    | 'category_deleted'

export type AdminActivityTargetType = 'gig' | 'order' | 'user' | 'category' | 'withdrawal'

// Toolbar filter groups → sets of AdminActionType.
export type AdminActivityFilter =
    | 'all'
    | 'gig_approvals'
    | 'gig_rejections'
    | 'dispute_verdicts'
    | 'withdrawals'
    | 'endorsements'
    | 'categories'

export const ACTION_TYPES_BY_FILTER: Record<Exclude<AdminActivityFilter, 'all'>, AdminActionType[]> = {
    gig_approvals: ['gig_approved'],
    gig_rejections: ['gig_rejected'],
    dispute_verdicts: ['dispute_resolved'],
    withdrawals: ['withdrawal_processed', 'withdrawal_rejected'],
    endorsements: ['user_endorsed', 'endorsement_revoked'],
    categories: ['category_created', 'category_edited', 'category_deleted']
}
