export const MESSAGING_REPOSITORY_PORT = 'MESSAGING_REPOSITORY_PORT'

// `avatarKey` is the S3 object key — controllers resolve to a presigned URL before responding.
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
    // Only meaningful for messages sent by the viewer; always false for received messages.
    readByRecipient: boolean
}

export interface FileItem extends AttachmentItem {
    messageId: string
    senderId: string | null
    senderName: string | null
    createdAt: Date
}

// The frontend carries these ids into the Send call; the handler claims them by
// linking staged rows to the new message id.
export interface StagedAttachment {
    id: string
    key: string
    name: string
    size: number
    mime: string
}

export interface MessagingRepositoryPort {
    createOrGetThread(userAId: string, userBId: string): Promise<{ id: string; createdNow: boolean }>

    // Returns null when thread doesn't exist OR viewer isn't a participant.
    getThreadById(threadId: string, viewerId: string): Promise<{ id: string; otherUserId: string } | null>

    listConversations(
        viewerId: string,
        page: number,
        pageSize: number
    ): Promise<{ items: ConversationListItem[]; total: number }>

    // Pass `opts.orderId` to also include system events (senderId NULL) tied to
    // that order — rendered as system event pills on the Order Workspace view.
    listMessages(
        threadId: string,
        beforeId: string | null,
        pageSize: number,
        opts?: { orderId?: string }
    ): Promise<MessageItem[]>

    // Inserts message + claims staged attachments + updates lastMessageAt in one $transaction.
    insertMessage(input: {
        threadId: string
        senderId: string
        body: string | null
        orderId: string | null
        attachmentIds: string[]
    }): Promise<MessageItem>

    // senderId is null, orderId required. body = JSON.stringify({ type, payload })
    // for <SystemEventPill />. Pass the same `tx` Prisma client for atomicity.
    insertSystemEvent(input: {
        threadId: string
        orderId: string
        type: string
        payload: Record<string, unknown>
        at: Date
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx?: any
    }): Promise<MessageItem>

    getMessageById(messageId: string, viewerId: string): Promise<MessageItem | null>

    markThreadRead(threadId: string, userId: string): Promise<{ unreadCleared: number; lastReadAt: Date }>

    getUnreadCount(userId: string): Promise<number>

    // When orderId is provided, restricts to attachments on messages tagged with
    // that order — scopes the Order Workspace Files modal to this order only.
    listThreadFiles(threadId: string, viewerId: string, opts?: { orderId?: string }): Promise<FileItem[]>

    stageAttachment(input: {
        senderId: string
        key: string
        name: string
        size: number
        mime: string
    }): Promise<StagedAttachment>

    // Returns null if viewer is neither the uploader nor a thread participant.
    getAttachmentForResolve(
        attachmentId: string,
        viewerId: string
    ): Promise<{ id: string; key: string; name: string } | null>

    // Median seller-response delay (seconds, capped at 24h per pair) over `days`.
    // Multiple inbound bursts between outbounds collapse into one sample.
    getResponseTimeSamples(userId: string, days: number): Promise<{ medianSeconds: number | null; sampleCount: number }>

    setLastSeen(userId: string, at: Date): Promise<void>

    // Used to scope presence:update emits to relevant peers only.
    listThreadPeers(userId: string): Promise<string[]>
}
