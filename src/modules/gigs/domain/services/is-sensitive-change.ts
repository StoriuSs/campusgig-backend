import { GigWithRelations } from '../ports/gig.repository.port'
import { UpdateGigData } from '../ports/gig.repository.port'

/**
 * Compare an UpdateGigData patch against the current GigWithRelations bundle
 * and return whether any sensitive field changed.
 *
 * Sensitive: title, categoryId, description, bullets, faqs, images.
 * Non-sensitive: priceVnd, deliveryDays.
 *
 * Bullets / faqs / images use replace-all semantics — any added, removed, or
 * reordered element counts as a sensitive change.
 */
export function isSensitiveChange(current: GigWithRelations, patch: UpdateGigData): boolean {
    if (patch.title !== undefined && patch.title.trim() !== current.gig.title) {
        return true
    }
    if (patch.categoryId !== undefined && patch.categoryId !== current.gig.categoryId) {
        return true
    }
    if (patch.description !== undefined && patch.description.trim() !== current.gig.description) {
        return true
    }
    if (patch.bullets !== undefined) {
        const newBullets = patch.bullets.map((b) => b.trim())
        const currentBullets = current.bullets.map((b) => b.text)
        if (!arraysEqualOrdered(newBullets, currentBullets)) {
            return true
        }
    }
    if (patch.faqs !== undefined) {
        const newFaqs = patch.faqs.map((f) => `${f.question.trim()}|${f.answer.trim()}`)
        const currentFaqs = current.faqs.map((f) => `${f.question}|${f.answer}`)
        if (!arraysEqualOrdered(newFaqs, currentFaqs)) {
            return true
        }
    }
    if (patch.imageIds !== undefined) {
        const currentIds = current.images.map((i) => i.id)
        if (!arraysEqualOrdered(patch.imageIds, currentIds)) {
            return true
        }
    }
    return false
}

function arraysEqualOrdered(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false
    }
    return true
}
