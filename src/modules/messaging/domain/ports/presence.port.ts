export const PRESENCE_PORT = 'PRESENCE_PORT'

// Tracks open WebSocket connections per user, deduped across multi-tab
// clients via an INCR/DECR counter. The gateway calls markOnline on connect
// and markOffline on disconnect; only the LAST disconnect counts as "going
// offline" so multi-tab users don't flicker.
export interface PresencePort {
    markOnline(userId: string, socketId: string): Promise<void>

    // Returns true ONLY when this was the last open socket for the user
    // (so the gateway knows to write lastSeenAt + emit presence:update).
    markOffline(userId: string, socketId: string): Promise<boolean>

    isOnline(userId: string): Promise<boolean>

    // Bulk lookup for the conversation list — one Redis call instead of N.
    filterOnline(userIds: string[]): Promise<Set<string>>

    // Called at module init to clear any sticky-online ghosts left over from
    // a server crash (no graceful disconnect → counters never decremented).
    clearAll(): Promise<void>
}
