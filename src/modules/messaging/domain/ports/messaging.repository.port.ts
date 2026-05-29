export const MESSAGING_REPOSITORY_PORT = 'MESSAGING_REPOSITORY_PORT'

// User info shown in conversation rows and presence updates. `avatarKey` is
// the S3 object key — controllers resolve to a presigned URL before responding.
export interface ThreadCounterpartInfo {
    id: string
    username: string | null
    displayName: string | null
    avatarKey: string | null
}

export interface MessagePreviewInfo {
    body: string | null
    senderId: string | null
    createdAt: Date
    hasAttachments: boolean
}

export interface ConversationListItem {
    threadId: string
    otherUser: ThreadCounterpartInfo
    lastMessage: MessagePreviewInfo | null
    unreadCount: number
    online: boolean
    lastSeenAt: Date | null
}

export interface AttachmentItem {
    id: string
    key: string
    name: string
    size: number
    mime: string
}

export interface MessageItem {
    id: string
    threadId: string
    senderId: string | null
    body: string | null
    orderId: string | null
    createdAt: Date
    attachments: AttachmentItem[]
    // Derived: whether the OTHER participant has read this message (only
    // meaningful for messages sent by the viewer). For received messages this
    // is always false from the viewer's perspective.
    readByRecipient: boolean
}

export interface FileItem extends AttachmentItem {
    messageId: string
    senderId: string | null
    senderName: string | null
    createdAt: Date
}

// Returned from the staging upload endpoint. The frontend carries the ids
// into the subsequent Send call where the SendMessage handler claims the
// staged rows by linking them to the new message id.
export interface StagedAttachment {
    id: string
    key: string
    name: string
    size: number
    mime: string
}

export interface MessagingRepositoryPort {
    // ---- Threads ----
    createOrGetThread(userAId: string, userBId: string): Promise<{ id: string; createdNow: boolean }>

    // Returns null when the thread doesn't exist OR the viewer isn't a
    // participant. Single membership-check entry-point used by every command
    // and query that takes a threadId.
    getThreadById(threadId: string, viewerId: string): Promise<{ id: string; otherUserId: string } | null>

    listConversations(
        viewerId: string,
        page: number,
        pageSize: number
    ): Promise<{ items: ConversationListItem[]; total: number }>

    // ---- Messages ----
    listMessages(threadId: string, beforeId: string | null, pageSize: number): Promise<MessageItem[]>

    // Inserts a message + claims the staged attachments (sets their messageId)
    // + updates the thread's lastMessageAt — all in one $transaction.
    insertMessage(input: {
        threadId: string
        senderId: string
        body: string | null
        orderId: string | null
        attachmentIds: string[]
    }): Promise<MessageItem>

    getMessageById(messageId: string, viewerId: string): Promise<MessageItem | null>

    // ---- Read cursor ----
    markThreadRead(threadId: string, userId: string): Promise<{ unreadCleared: number; lastReadAt: Date }>

    getUnreadCount(userId: string): Promise<number>

    // ---- Files ----
    listThreadFiles(threadId: string, viewerId: string): Promise<FileItem[]>

    // ---- Attachments (staging) ----
    stageAttachment(input: {
        senderId: string
        key: string
        name: string
        size: number
        mime: string
    }): Promise<StagedAttachment>

    // Authorizes that the viewer is the original uploader (or a participant
    // of the message it ended up in) before resolving the URL. Returns the
    // filename too so the controller can build a download-friendly
    // Content-Disposition.
    getAttachmentForResolve(
        attachmentId: string,
        viewerId: string
    ): Promise<{ id: string; key: string; name: string } | null>

    // ---- Response-time stats ----
    // Returns the median seller-response delay (in seconds, capped per-pair
    // at 24h) over the last `days` window, plus the number of "session"
    // samples that contributed. A session = (first inbound after the
    // viewer's previous outbound) → (next outbound). One pair per session
    // — multiple back-and-forth inbound bursts collapse into one sample so
    // a fast small-talk thread can't dominate the average.
    getResponseTimeSamples(userId: string, days: number): Promise<{ medianSeconds: number | null; sampleCount: number }>

    // ---- Presence ----
    setLastSeen(userId: string, at: Date): Promise<void>

    // Returns the list of user ids that share a thread with the given user.
    // Used to scope presence:update emits.
    listThreadPeers(userId: string): Promise<string[]>
}
