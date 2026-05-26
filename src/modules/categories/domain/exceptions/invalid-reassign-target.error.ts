/**
 * Thrown when DELETE /admin/categories/:id is called with `reassignTo` that:
 *   - is the same as the id being deleted, OR
 *   - points at a non-existent category.
 */
export class InvalidReassignTargetException extends Error {
    constructor(
        public readonly reason: 'self' | 'not-found',
        public readonly reassignTo: string
    ) {
        super(
            reason === 'self'
                ? `Cannot reassign to the same category being deleted (${reassignTo}).`
                : `Reassign target category not found: ${reassignTo}.`
        )
        this.name = 'InvalidReassignTargetException'
    }
}
