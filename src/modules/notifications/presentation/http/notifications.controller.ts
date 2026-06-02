import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import { NotificationFilter } from '../../domain/notification.types'
import { NotificationItem } from '../../domain/ports/notification.repository.port'
import { ListNotificationsQuery } from '../../application/queries/list-notifications/list-notifications.query'
import { GetRecentNotificationsQuery } from '../../application/queries/get-recent-notifications/get-recent-notifications.query'
import type { RecentNotificationsResult } from '../../application/queries/get-recent-notifications/get-recent-notifications.handler'
import { GetUnreadCountQuery } from '../../application/queries/get-unread-count/get-unread-count.query'
import { MarkReadCommand } from '../../application/commands/mark-read/mark-read.command'
import { MarkAllReadCommand } from '../../application/commands/mark-all-read/mark-all-read.command'
import {
    NotificationListResponseDto,
    NotificationRowDto,
    RecentNotificationsResponseDto,
    UnreadCountResponseDto
} from './dto'

const PAGE_SIZE = 10
const RECENT_LIMIT = 5

function toRow(item: NotificationItem): NotificationRowDto {
    return {
        id: item.id,
        type: item.type,
        data: item.data,
        read: item.readAt != null,
        createdAt: item.createdAt.toISOString()
    }
}

@ApiTags('Notifications')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus
    ) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List my notifications (paginated, All/Unread)' })
    @ApiQuery({ name: 'filter', required: false, enum: ['all', 'unread'] })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiResponse({ status: 200, type: NotificationListResponseDto })
    async list(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Query('filter') filter?: string,
        @Query('page') page?: string
    ): Promise<ServiceResponse<NotificationListResponseDto>> {
        const parsedPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1)
        const result = await this.queryBus.execute(
            new ListNotificationsQuery(
                user.local.dbId,
                (filter === 'unread' ? 'unread' : 'all') as NotificationFilter,
                parsedPage,
                PAGE_SIZE
            )
        )
        const dto = validateAndTransform(NotificationListResponseDto, {
            items: result.items.map(toRow),
            total: result.total,
            page: parsedPage,
            pageSize: PAGE_SIZE
        })
        return createResponse(
            RESPONSE_CODES.NOTIFICATIONS_LIST_SUCCESS,
            RESPONSE_TYPES.NOTIFICATIONS_LIST,
            MESSAGES.NOTIFICATIONS.LISTED,
            dto
        )
    }

    @Get('recent')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Latest 5 notifications + unread count (bell popover)' })
    @ApiResponse({ status: 200, type: RecentNotificationsResponseDto })
    async recent(
        @CurrentUser() user: AuthenticatedKeycloakUser
    ): Promise<ServiceResponse<RecentNotificationsResponseDto>> {
        const result: RecentNotificationsResult = await this.queryBus.execute(
            new GetRecentNotificationsQuery(user.local.dbId, RECENT_LIMIT)
        )
        const dto = validateAndTransform(RecentNotificationsResponseDto, {
            items: result.items.map(toRow),
            unreadCount: result.unreadCount
        })
        return createResponse(
            RESPONSE_CODES.NOTIFICATIONS_RECENT_SUCCESS,
            RESPONSE_TYPES.NOTIFICATIONS_RECENT,
            MESSAGES.NOTIFICATIONS.RECENT,
            dto
        )
    }

    @Get('unread-count')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'My unread notification count (bell badge)' })
    @ApiResponse({ status: 200, type: UnreadCountResponseDto })
    async unreadCount(
        @CurrentUser() user: AuthenticatedKeycloakUser
    ): Promise<ServiceResponse<UnreadCountResponseDto>> {
        const count: number = await this.queryBus.execute(new GetUnreadCountQuery(user.local.dbId))
        const dto = validateAndTransform(UnreadCountResponseDto, { count })
        return createResponse(
            RESPONSE_CODES.NOTIFICATIONS_UNREAD_COUNT_SUCCESS,
            RESPONSE_TYPES.NOTIFICATIONS_UNREAD_COUNT,
            MESSAGES.NOTIFICATIONS.UNREAD_COUNT,
            dto
        )
    }

    @Post(':id/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark one notification as read' })
    async markRead(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string
    ): Promise<ServiceResponse<null>> {
        await this.commandBus.execute(new MarkReadCommand(id, user.local.dbId))
        return createResponse(
            RESPONSE_CODES.NOTIFICATION_READ_SUCCESS,
            RESPONSE_TYPES.NOTIFICATION_READ,
            MESSAGES.NOTIFICATIONS.MARKED_READ,
            null
        )
    }

    @Post('read-all')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark all my notifications as read' })
    async markAllRead(@CurrentUser() user: AuthenticatedKeycloakUser): Promise<ServiceResponse<null>> {
        await this.commandBus.execute(new MarkAllReadCommand(user.local.dbId))
        return createResponse(
            RESPONSE_CODES.NOTIFICATIONS_READ_ALL_SUCCESS,
            RESPONSE_TYPES.NOTIFICATIONS_READ_ALL,
            MESSAGES.NOTIFICATIONS.ALL_MARKED_READ,
            null
        )
    }
}
