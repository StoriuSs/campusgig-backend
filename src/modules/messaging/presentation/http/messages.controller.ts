import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    Param,
    ParseFilePipe,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { FilesInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { CurrentUser, Public } from '@/shared/infrastructure'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import {
    CreateOrGetThreadCommand,
    SendMessageCommand,
    MarkThreadReadCommand,
    UploadAttachmentCommand,
    GetInboxConversationsQuery,
    GetThreadMessagesQuery,
    GetUnreadCountQuery,
    GetThreadFilesQuery,
    ResolveAttachmentUrlQuery,
    GetResponseTimeQuery,
    ResponseTimeResult
} from '../../application'
import { GIG_STORAGE_PORT, GigStoragePort } from '@/modules/gigs/application/ports'
import {
    MESSAGE_ATTACHMENT_STORAGE_PORT,
    MessageAttachmentStoragePort,
    ConversationListItem,
    MessageItem,
    FileItem,
    StagedAttachment
} from '../../domain/ports'
import {
    AttachmentResponseDto,
    ConversationItemResponseDto,
    ConversationsListResponseDto,
    CreateThreadRequestDto,
    CreateThreadResponseDto,
    FileItemResponseDto,
    MarkReadResponseDto,
    MessageItemResponseDto,
    PresignUrlResponseDto,
    ResponseTimeResponseDto,
    SendMessageRequestDto,
    StagedAttachmentResponseDto,
    UnreadCountResponseDto
} from './dto'

const CONVERSATIONS_DEFAULT_PAGE_SIZE = 30
const CONVERSATIONS_MAX_PAGE_SIZE = 50
const MESSAGES_DEFAULT_PAGE_SIZE = 50
const MESSAGES_MAX_PAGE_SIZE = 100
const ATTACHMENT_PRESIGN_TTL_S = 600
const MAX_ATTACHMENTS_PER_REQUEST = 5
// Response-time bucket cache — long enough that hot seller pages aren't
// re-querying on every viewer, short enough that a flurry of fast replies
// is reflected within the hour. Per-send invalidation also exists, so
// this TTL is mostly a backstop against missed events.
const RESPONSE_TIME_TTL_S = 60 * 60

export function responseTimeCacheKey(userId: string): string {
    return `responseTime:${userId}`
}

@ApiTags('Messaging')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'messages', version: '1' })
export class MessagesController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        @Inject(MESSAGE_ATTACHMENT_STORAGE_PORT)
        private readonly attachmentStorage: MessageAttachmentStoragePort,
        @Inject(GIG_STORAGE_PORT)
        private readonly avatarStorage: GigStoragePort,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {}

    private async resolveAvatarKey(key: string | null): Promise<string | null> {
        if (!key) return null
        try {
            return await this.avatarStorage.getSignedReadUrl(key)
        } catch {
            return null
        }
    }

    // ── Threads ────────────────────────────────────────────────────────────

    @Post('threads')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Create or get the thread with another user' })
    @ApiResponse({ status: 200, type: CreateThreadResponseDto })
    async createOrGetThread(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Body() body: CreateThreadRequestDto
    ): Promise<ServiceResponse<CreateThreadResponseDto>> {
        const { threadId } = await this.commandBus.execute(
            new CreateOrGetThreadCommand(user.local.dbId, body.otherUserId)
        )
        const dto = validateAndTransform(CreateThreadResponseDto, { threadId })
        return createResponse(
            RESPONSE_CODES.MESSAGING_THREAD_CREATE_SUCCESS,
            RESPONSE_TYPES.MESSAGING_THREAD_CREATE,
            MESSAGES.MESSAGING.THREAD_CREATED,
            dto
        )
    }

    @Get('threads')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List my conversations (paginated, newest first)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiResponse({ status: 200, type: ConversationsListResponseDto })
    async listConversations(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Query('page') pageParam?: string,
        @Query('pageSize') pageSizeParam?: string
    ): Promise<ServiceResponse<ConversationsListResponseDto>> {
        const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
        const pageSize = Math.min(
            CONVERSATIONS_MAX_PAGE_SIZE,
            Number.parseInt(pageSizeParam ?? String(CONVERSATIONS_DEFAULT_PAGE_SIZE), 10) ||
                CONVERSATIONS_DEFAULT_PAGE_SIZE
        )

        const result: { items: ConversationListItem[]; total: number } = await this.queryBus.execute(
            new GetInboxConversationsQuery(user.local.dbId, page, pageSize)
        )

        // Avatars are S3 keys; resolve to presigned URLs in parallel.
        const items: ConversationItemResponseDto[] = await Promise.all(
            result.items.map(async (item) => {
                const avatarUrl = await this.resolveAvatarKey(item.otherUser.avatarKey)
                return validateAndTransform(ConversationItemResponseDto, {
                    threadId: item.threadId,
                    otherUser: {
                        id: item.otherUser.id,
                        username: item.otherUser.username,
                        displayName: item.otherUser.displayName,
                        avatarUrl
                    },
                    lastMessage: item.lastMessage
                        ? {
                              body: item.lastMessage.body,
                              senderId: item.lastMessage.senderId,
                              createdAt: item.lastMessage.createdAt.toISOString(),
                              hasAttachments: item.lastMessage.hasAttachments
                          }
                        : null,
                    unreadCount: item.unreadCount,
                    online: item.online,
                    lastSeenAt: item.lastSeenAt ? item.lastSeenAt.toISOString() : null
                })
            })
        )

        const dto = validateAndTransform(ConversationsListResponseDto, {
            items,
            total: result.total,
            page,
            pageSize
        })

        return createResponse(
            RESPONSE_CODES.MESSAGING_CONVERSATIONS_LIST_SUCCESS,
            RESPONSE_TYPES.MESSAGING_CONVERSATIONS_LIST,
            MESSAGES.MESSAGING.CONVERSATIONS_LISTED,
            dto
        )
    }

    // ── Messages ───────────────────────────────────────────────────────────

    @Get('threads/:threadId/messages')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List messages in a thread (newest first, cursor by beforeId)' })
    @ApiQuery({ name: 'beforeId', required: false, type: String })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiResponse({ status: 200, type: MessageItemResponseDto, isArray: true })
    async listMessages(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('threadId') threadId: string,
        @Query('beforeId') beforeId?: string,
        @Query('pageSize') pageSizeParam?: string
    ): Promise<ServiceResponse<MessageItemResponseDto[]>> {
        const pageSize = Math.min(
            MESSAGES_MAX_PAGE_SIZE,
            Number.parseInt(pageSizeParam ?? String(MESSAGES_DEFAULT_PAGE_SIZE), 10) || MESSAGES_DEFAULT_PAGE_SIZE
        )

        const messages: MessageItem[] = await this.queryBus.execute(
            new GetThreadMessagesQuery(user.local.dbId, threadId, beforeId ?? null, pageSize)
        )

        const items = await Promise.all(messages.map((m) => this.toMessageDto(m)))

        return createResponse(
            RESPONSE_CODES.MESSAGING_MESSAGES_LIST_SUCCESS,
            RESPONSE_TYPES.MESSAGING_MESSAGES_LIST,
            MESSAGES.MESSAGING.MESSAGES_LISTED,
            items
        )
    }

    @Post('threads/:threadId/messages')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Send a message (body and/or staged attachments)' })
    @ApiResponse({ status: 201, type: MessageItemResponseDto })
    async sendMessage(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('threadId') threadId: string,
        @Body() body: SendMessageRequestDto
    ): Promise<ServiceResponse<MessageItemResponseDto>> {
        const message: MessageItem = await this.commandBus.execute(
            new SendMessageCommand(user.local.dbId, threadId, body.body ?? null, body.attachmentIds ?? [])
        )

        const dto = await this.toMessageDto(message)

        return createResponse(
            RESPONSE_CODES.MESSAGING_MESSAGE_SEND_SUCCESS,
            RESPONSE_TYPES.MESSAGING_MESSAGE_SEND,
            MESSAGES.MESSAGING.MESSAGE_SENT,
            dto
        )
    }

    // ── Attachments ────────────────────────────────────────────────────────

    @Post('threads/:threadId/attachments')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FilesInterceptor('files', MAX_ATTACHMENTS_PER_REQUEST, { storage: memoryStorage() }))
    @ApiOperation({
        summary: 'Upload chat attachments (staged, claimed on Send)',
        description: 'Multipart with up to 5 files keyed as `files`. Returns per-file staged ids.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                files: { type: 'array', items: { type: 'string', format: 'binary' } }
            }
        }
    })
    @ApiResponse({ status: 201, type: StagedAttachmentResponseDto, isArray: true })
    async uploadAttachments(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('threadId') threadId: string,
        @UploadedFiles(new ParseFilePipe({ fileIsRequired: true }))
        files: Express.Multer.File[]
    ): Promise<ServiceResponse<StagedAttachmentResponseDto[]>> {
        const staged: StagedAttachment[] = []
        for (const file of files) {
            // Multer decodes multipart filenames as Latin-1 by default but the
            // browser sends UTF-8, so non-ASCII names (Vietnamese, CJK, accents)
            // arrive mojibake'd ("công" → "cÃ´ng"). Re-encode here.
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
            const result: StagedAttachment = await this.commandBus.execute(
                new UploadAttachmentCommand(user.local.dbId, threadId, originalName, file.mimetype, file.buffer)
            )
            staged.push(result)
        }

        const dtos = staged.map((s) =>
            validateAndTransform(StagedAttachmentResponseDto, {
                id: s.id,
                name: s.name,
                size: s.size,
                mime: s.mime
            })
        )

        return createResponse(
            RESPONSE_CODES.MESSAGING_ATTACHMENT_UPLOAD_SUCCESS,
            RESPONSE_TYPES.MESSAGING_ATTACHMENT_UPLOAD,
            MESSAGES.MESSAGING.ATTACHMENT_UPLOADED,
            dtos
        )
    }

    @Get('threads/:threadId/attachments/:attachmentId/url')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get a short-lived presigned URL for a chat attachment',
        description: 'Pass ?download=1 to receive a URL that triggers Save As instead of inline render.'
    })
    @ApiQuery({ name: 'download', required: false, type: Boolean })
    @ApiResponse({ status: 200, type: PresignUrlResponseDto })
    async resolveAttachmentUrl(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('threadId') _threadId: string,
        @Param('attachmentId') attachmentId: string,
        @Query('download') downloadFlag?: string
    ): Promise<ServiceResponse<PresignUrlResponseDto>> {
        const forDownload = downloadFlag === '1' || downloadFlag === 'true'
        const result: { url: string; expiresAt: Date } = await this.queryBus.execute(
            new ResolveAttachmentUrlQuery(user.local.dbId, attachmentId, forDownload)
        )
        const dto = validateAndTransform(PresignUrlResponseDto, {
            url: result.url,
            expiresAt: result.expiresAt.toISOString()
        })
        return createResponse(
            RESPONSE_CODES.MESSAGING_ATTACHMENT_RESOLVE_SUCCESS,
            RESPONSE_TYPES.MESSAGING_ATTACHMENT_RESOLVE,
            MESSAGES.MESSAGING.ATTACHMENT_RESOLVED,
            dto
        )
    }

    // ── Read cursor + unread ───────────────────────────────────────────────

    @Post('threads/:threadId/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark the thread read for the current viewer' })
    @ApiResponse({ status: 200, type: MarkReadResponseDto })
    async markRead(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('threadId') threadId: string
    ): Promise<ServiceResponse<MarkReadResponseDto>> {
        const result: { lastReadAt: Date; unreadCleared: number } = await this.commandBus.execute(
            new MarkThreadReadCommand(user.local.dbId, threadId)
        )
        const dto = validateAndTransform(MarkReadResponseDto, {
            lastReadAt: result.lastReadAt.toISOString(),
            unreadCleared: result.unreadCleared
        })
        return createResponse(
            RESPONSE_CODES.MESSAGING_THREAD_READ_SUCCESS,
            RESPONSE_TYPES.MESSAGING_THREAD_READ,
            MESSAGES.MESSAGING.THREAD_READ,
            dto
        )
    }

    @Get('unread-count')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Total unread message count across all my threads' })
    @ApiResponse({ status: 200, type: UnreadCountResponseDto })
    async unreadCount(
        @CurrentUser() user: AuthenticatedKeycloakUser
    ): Promise<ServiceResponse<UnreadCountResponseDto>> {
        const { count }: { count: number } = await this.queryBus.execute(new GetUnreadCountQuery(user.local.dbId))
        const dto = validateAndTransform(UnreadCountResponseDto, { count })
        return createResponse(
            RESPONSE_CODES.MESSAGING_UNREAD_COUNT_SUCCESS,
            RESPONSE_TYPES.MESSAGING_UNREAD_COUNT,
            MESSAGES.MESSAGING.UNREAD_COUNT_FETCHED,
            dto
        )
    }

    // ── Public stats ───────────────────────────────────────────────────────

    @Get('users/:userId/response-time')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "Get the seller's median response-time bucket",
        description:
            'Public — used by the gig detail seller card and public profile header. Returns no_data when the seller has fewer than 5 response samples in the trailing 60-day window. Cached for 1 hour and invalidated whenever the seller sends a message.'
    })
    @ApiResponse({ status: 200, type: ResponseTimeResponseDto })
    async getResponseTime(@Param('userId') userId: string): Promise<ServiceResponse<ResponseTimeResponseDto>> {
        const cacheKey = responseTimeCacheKey(userId)
        const cached = await this.cache.get<ResponseTimeResponseDto>(cacheKey)
        if (cached) {
            return createResponse(
                RESPONSE_CODES.MESSAGING_RESPONSE_TIME_SUCCESS,
                RESPONSE_TYPES.MESSAGING_RESPONSE_TIME,
                MESSAGES.MESSAGING.RESPONSE_TIME_FETCHED,
                cached
            )
        }

        const result: ResponseTimeResult = await this.queryBus.execute(new GetResponseTimeQuery(userId))
        const dto = validateAndTransform(ResponseTimeResponseDto, {
            bucket: result.bucket,
            sampleCount: result.sampleCount,
            windowDays: result.windowDays
        })
        await this.cache.set(cacheKey, dto, RESPONSE_TIME_TTL_S * 1000)

        return createResponse(
            RESPONSE_CODES.MESSAGING_RESPONSE_TIME_SUCCESS,
            RESPONSE_TYPES.MESSAGING_RESPONSE_TIME,
            MESSAGES.MESSAGING.RESPONSE_TIME_FETCHED,
            dto
        )
    }

    // ── Files ──────────────────────────────────────────────────────────────

    @Get('threads/:threadId/files')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'All chat files exchanged in a thread (newest first)' })
    @ApiResponse({ status: 200, type: FileItemResponseDto, isArray: true })
    async listFiles(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('threadId') threadId: string
    ): Promise<ServiceResponse<FileItemResponseDto[]>> {
        const files: FileItem[] = await this.queryBus.execute(new GetThreadFilesQuery(user.local.dbId, threadId))
        const items = files.map((f) =>
            validateAndTransform(FileItemResponseDto, {
                id: f.id,
                messageId: f.messageId,
                name: f.name,
                size: f.size,
                mime: f.mime,
                senderId: f.senderId,
                senderName: f.senderName,
                createdAt: f.createdAt.toISOString()
            })
        )
        return createResponse(
            RESPONSE_CODES.MESSAGING_FILES_LIST_SUCCESS,
            RESPONSE_TYPES.MESSAGING_FILES_LIST,
            MESSAGES.MESSAGING.FILES_LISTED,
            items
        )
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private async toMessageDto(m: MessageItem): Promise<MessageItemResponseDto> {
        const attachments: AttachmentResponseDto[] = await Promise.all(
            m.attachments.map(async (a) => {
                let url = ''
                try {
                    url = await this.attachmentStorage.presignGetUrl(a.key, ATTACHMENT_PRESIGN_TTL_S)
                } catch {
                    /* swallow — frontend handles empty url */
                }
                return validateAndTransform(AttachmentResponseDto, {
                    id: a.id,
                    name: a.name,
                    size: a.size,
                    mime: a.mime,
                    url
                })
            })
        )

        return validateAndTransform(MessageItemResponseDto, {
            id: m.id,
            threadId: m.threadId,
            senderId: m.senderId,
            body: m.body,
            orderId: m.orderId,
            createdAt: m.createdAt.toISOString(),
            attachments,
            readByRecipient: m.readByRecipient
        })
    }
}
