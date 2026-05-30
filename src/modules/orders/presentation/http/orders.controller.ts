import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    NotFoundException,
    Param,
    ParseFilePipe,
    ParseUUIDPipe,
    Post,
    Query,
    UploadedFile,
    UseInterceptors
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { memoryStorage } from 'multer'

import { GIG_STORAGE_PORT, GigStoragePort } from '@/modules/gigs/application/ports'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { formatOrderCode, validateAndTransform } from '@/shared/utils'

import {
    AcceptDeliveryCommand,
    AcceptOrderCommand,
    DeclineOrderCommand,
    DeliverWorkCommand,
    GetActionRequiredCountsQuery,
    GetOrderEventsQuery,
    GetOrderQuery,
    ListOrdersQuery,
    PlaceOrderCommand,
    UpdateDeliveryCommand,
    UploadDeliveryFileCommand
} from '../../application'
import {
    DELIVERY_STORAGE_PORT,
    DeliveryFileItem,
    DeliveryItem,
    DeliveryStoragePort,
    ORDERS_REPOSITORY_PORT,
    OrderDetail,
    OrderEventItem,
    OrderListRow,
    OrderStatusCounts,
    OrdersRepositoryPort,
    OrdersSort
} from '../../domain/ports'
import {
    ActionRequiredCountsResponseDto,
    DeclineOrderRequestDto,
    DeliverWorkRequestDto,
    DeliveryFileUrlResponseDto,
    DeliveryResponseDto,
    ListOrdersRequestDto,
    OrderDetailResponseDto,
    OrderEventResponseDto,
    OrderListResponseDto,
    OrderListRowResponseDto,
    PlaceOrderRequestDto,
    StagedDeliveryFileResponseDto
} from './dto'

const DELIVERY_PRESIGN_TTL_S = 600
const ORDERS_DEFAULT_PAGE_SIZE = 10
const ORDERS_MAX_PAGE_SIZE = 50

@ApiTags('Orders')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        @Inject(DELIVERY_STORAGE_PORT)
        private readonly deliveryStorage: DeliveryStoragePort,
        @Inject(GIG_STORAGE_PORT)
        private readonly imageStorage: GigStoragePort,
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly ordersRepo: OrdersRepositoryPort
    ) {}

    // ── List & counts ──────────────────────────────────────────────────────

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List my orders (paginated, filtered, sorted)' })
    @ApiResponse({ status: 200, type: OrderListResponseDto })
    async listOrders(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Query() query: ListOrdersRequestDto
    ): Promise<ServiceResponse<OrderListResponseDto>> {
        const page = query.page ?? 1
        const pageSize = Math.min(query.pageSize ?? ORDERS_DEFAULT_PAGE_SIZE, ORDERS_MAX_PAGE_SIZE)

        const result: {
            items: OrderListRow[]
            total: number
            counts: OrderStatusCounts
        } = await this.queryBus.execute(
            new ListOrdersQuery(
                user.local.dbId,
                query.side,
                query.status ?? 'all',
                query.actionRequiredOnly === 'true',
                query.q ?? null,
                (query.sort ?? 'most_urgent') as OrdersSort,
                page,
                pageSize
            )
        )

        const items: OrderListRowResponseDto[] = await Promise.all(result.items.map((row) => this.toListRowDto(row)))

        const dto = {
            items,
            total: result.total,
            page,
            pageSize,
            counts: result.counts
        }

        return createResponse(
            RESPONSE_CODES.ORDERS_LIST_SUCCESS,
            RESPONSE_TYPES.ORDERS_LIST,
            MESSAGES.ORDERS.LISTED,
            dto as unknown as OrderListResponseDto
        )
    }

    @Get('active-with/:otherUserId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Active orders between me and one specific user (powers the Inbox header banner)'
    })
    async listActiveWith(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('otherUserId', new ParseUUIDPipe()) otherUserId: string
    ): Promise<ServiceResponse<{ items: OrderListRowResponseDto[] }>> {
        const rows = await this.ordersRepo.listActiveBetween(user.local.dbId, otherUserId)
        const items = await Promise.all(rows.map((row) => this.toListRowDto(row)))
        return createResponse(RESPONSE_CODES.ORDERS_LIST_SUCCESS, RESPONSE_TYPES.ORDERS_LIST, MESSAGES.ORDERS.LISTED, {
            items
        })
    }

    @Get('action-required/counts')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'My action-required counts split by side' })
    @ApiResponse({ status: 200, type: ActionRequiredCountsResponseDto })
    async getActionRequiredCounts(
        @CurrentUser() user: AuthenticatedKeycloakUser
    ): Promise<ServiceResponse<ActionRequiredCountsResponseDto>> {
        const result: { asBuyer: number; asSeller: number } = await this.queryBus.execute(
            new GetActionRequiredCountsQuery(user.local.dbId)
        )
        const dto = validateAndTransform(ActionRequiredCountsResponseDto, result)
        return createResponse(
            RESPONSE_CODES.ORDERS_ACTION_COUNTS_SUCCESS,
            RESPONSE_TYPES.ORDERS_ACTION_COUNTS,
            MESSAGES.ORDERS.ACTION_COUNTS_FETCHED,
            dto
        )
    }

    // ── Place order ────────────────────────────────────────────────────────

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Place a new order (escrow + buyer wallet debit)' })
    @ApiResponse({ status: 201, type: OrderDetailResponseDto })
    async placeOrder(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Body() body: PlaceOrderRequestDto
    ): Promise<ServiceResponse<OrderDetailResponseDto>> {
        const order: OrderDetail = await this.commandBus.execute(
            new PlaceOrderCommand(user.local.dbId, body.gigId, body.idempotencyKey)
        )
        const dto = await this.toDetailDto(order)
        return createResponse(
            RESPONSE_CODES.ORDERS_PLACE_SUCCESS,
            RESPONSE_TYPES.ORDERS_PLACE,
            MESSAGES.ORDERS.PLACED,
            dto
        )
    }

    // ── Single order: detail + events ──────────────────────────────────────

    @Get(':orderId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get full Order Workspace detail for the viewer' })
    @ApiResponse({ status: 200, type: OrderDetailResponseDto })
    async getOrder(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string
    ): Promise<ServiceResponse<OrderDetailResponseDto>> {
        const order: OrderDetail = await this.queryBus.execute(new GetOrderQuery(user.local.dbId, orderId))
        const dto = await this.toDetailDto(order)
        return createResponse(
            RESPONSE_CODES.ORDERS_FETCH_SUCCESS,
            RESPONSE_TYPES.ORDERS_FETCH,
            MESSAGES.ORDERS.FETCHED,
            dto
        )
    }

    @Get(':orderId/events')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Order activity timeline (chronological)' })
    @ApiResponse({ status: 200, type: OrderEventResponseDto, isArray: true })
    async listEvents(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string
    ): Promise<ServiceResponse<OrderEventResponseDto[]>> {
        const events: OrderEventItem[] = await this.queryBus.execute(new GetOrderEventsQuery(user.local.dbId, orderId))
        const items = events.map((e) =>
            validateAndTransform(OrderEventResponseDto, {
                id: e.id,
                orderId: e.orderId,
                type: e.type,
                actorUserId: e.actorUserId,
                payload: e.payload,
                createdAt: e.createdAt.toISOString()
            })
        )
        return createResponse(
            RESPONSE_CODES.ORDERS_EVENTS_FETCH_SUCCESS,
            RESPONSE_TYPES.ORDERS_EVENTS_FETCH,
            MESSAGES.ORDERS.EVENTS_FETCHED,
            items
        )
    }

    // ── Phase-1 transitions ────────────────────────────────────────────────

    @Post(':orderId/accept')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Seller accepts a pending order' })
    @ApiResponse({ status: 200, type: OrderDetailResponseDto })
    async acceptOrder(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string
    ): Promise<ServiceResponse<OrderDetailResponseDto>> {
        const order: OrderDetail = await this.commandBus.execute(new AcceptOrderCommand(user.local.dbId, orderId))
        const dto = await this.toDetailDto(order)
        return createResponse(
            RESPONSE_CODES.ORDERS_ACCEPT_SUCCESS,
            RESPONSE_TYPES.ORDERS_ACCEPT,
            MESSAGES.ORDERS.ACCEPTED,
            dto
        )
    }

    @Post(':orderId/decline')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Seller declines a pending order (refunds buyer)' })
    @ApiResponse({ status: 200, type: OrderDetailResponseDto })
    async declineOrder(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string,
        @Body() body: DeclineOrderRequestDto
    ): Promise<ServiceResponse<OrderDetailResponseDto>> {
        const order: OrderDetail = await this.commandBus.execute(
            new DeclineOrderCommand(user.local.dbId, orderId, body.note)
        )
        const dto = await this.toDetailDto(order)
        return createResponse(
            RESPONSE_CODES.ORDERS_DECLINE_SUCCESS,
            RESPONSE_TYPES.ORDERS_DECLINE,
            MESSAGES.ORDERS.DECLINED,
            dto
        )
    }

    @Post(':orderId/deliver')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Seller delivers the work (creates a new Delivery version)'
    })
    @ApiResponse({ status: 200, type: OrderDetailResponseDto })
    async deliverWork(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string,
        @Body() body: DeliverWorkRequestDto
    ): Promise<ServiceResponse<OrderDetailResponseDto>> {
        const order: OrderDetail = await this.commandBus.execute(
            new DeliverWorkCommand(user.local.dbId, orderId, body.note, body.stagedFileIds)
        )
        const dto = await this.toDetailDto(order)
        return createResponse(
            RESPONSE_CODES.ORDERS_DELIVER_SUCCESS,
            RESPONSE_TYPES.ORDERS_DELIVER,
            MESSAGES.ORDERS.DELIVERED,
            dto
        )
    }

    @Post(':orderId/deliver/update')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "Seller updates the delivery (new Delivery version; v1's review countdown is preserved)"
    })
    @ApiResponse({ status: 200, type: OrderDetailResponseDto })
    async updateDelivery(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string,
        @Body() body: DeliverWorkRequestDto
    ): Promise<ServiceResponse<OrderDetailResponseDto>> {
        const order: OrderDetail = await this.commandBus.execute(
            new UpdateDeliveryCommand(user.local.dbId, orderId, body.note, body.stagedFileIds)
        )
        const dto = await this.toDetailDto(order)
        return createResponse(
            RESPONSE_CODES.ORDERS_DELIVERY_UPDATE_SUCCESS,
            RESPONSE_TYPES.ORDERS_DELIVERY_UPDATE,
            MESSAGES.ORDERS.DELIVERY_UPDATED,
            dto
        )
    }

    @Get(':orderId/deliveries')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'All Delivery versions for the order (newest version first)'
    })
    @ApiResponse({ status: 200, type: DeliveryResponseDto, isArray: true })
    async listDeliveries(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string
    ): Promise<ServiceResponse<DeliveryResponseDto[]>> {
        const deliveries: DeliveryItem[] = await this.ordersRepo.listDeliveries(orderId, user.local.dbId)
        const items = deliveries.map((d) => this.toDeliveryDto(d))
        return createResponse(
            RESPONSE_CODES.ORDERS_DELIVERIES_LIST_SUCCESS,
            RESPONSE_TYPES.ORDERS_DELIVERIES_LIST,
            MESSAGES.ORDERS.DELIVERIES_LISTED,
            items
        )
    }

    @Post(':orderId/accept-delivery')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Buyer accepts the delivery (releases escrow to seller + platform fee)'
    })
    @ApiResponse({ status: 200, type: OrderDetailResponseDto })
    async acceptDelivery(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string
    ): Promise<ServiceResponse<OrderDetailResponseDto>> {
        const order: OrderDetail = await this.commandBus.execute(new AcceptDeliveryCommand(user.local.dbId, orderId))
        const dto = await this.toDetailDto(order)
        return createResponse(
            RESPONSE_CODES.ORDERS_ACCEPT_DELIVERY_SUCCESS,
            RESPONSE_TYPES.ORDERS_ACCEPT_DELIVERY,
            MESSAGES.ORDERS.DELIVERY_ACCEPTED,
            dto
        )
    }

    // ── Delivery files (staged upload + presigned read) ────────────────────

    @Post(':orderId/deliveries/staged-files')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    @ApiOperation({
        summary: 'Upload a single staged delivery file (claimed on Deliver)',
        description:
            'Multipart with one file keyed as `file`. The returned id must be passed back via POST /orders/:orderId/deliver to attach it.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' }
            }
        }
    })
    @ApiResponse({ status: 201, type: StagedDeliveryFileResponseDto })
    async uploadStagedDeliveryFile(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string,
        @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
        file: Express.Multer.File
    ): Promise<ServiceResponse<StagedDeliveryFileResponseDto>> {
        // Same Vietnamese / CJK rescue as messaging — Multer hands us Latin-1
        // bytes for the original filename even though the wire encoding is UTF-8.
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
        const staged: DeliveryFileItem = await this.commandBus.execute(
            new UploadDeliveryFileCommand(user.local.dbId, orderId, originalName, file.mimetype, file.buffer)
        )
        const dto = validateAndTransform(StagedDeliveryFileResponseDto, {
            id: staged.id,
            name: staged.name,
            size: staged.size,
            mime: staged.mime,
            createdAt: staged.createdAt.toISOString()
        })
        return createResponse(
            RESPONSE_CODES.ORDERS_DELIVERY_FILE_STAGE_SUCCESS,
            RESPONSE_TYPES.ORDERS_DELIVERY_FILE_STAGE,
            MESSAGES.ORDERS.DELIVERY_FILE_STAGED,
            dto
        )
    }

    @Get(':orderId/deliveries/:deliveryId/files/:fileId/url')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Resolve a delivery file to a short-lived presigned URL',
        description: 'Pass ?download=1 for Save-As; default opens inline.'
    })
    @ApiQuery({ name: 'download', required: false, type: Boolean })
    @ApiResponse({ status: 200, type: DeliveryFileUrlResponseDto })
    async resolveDeliveryFileUrl(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string,
        @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
        @Param('fileId', new ParseUUIDPipe()) fileId: string,
        @Query('download') downloadFlag?: string
    ): Promise<ServiceResponse<DeliveryFileUrlResponseDto>> {
        // The repo enforces "viewer is buyer or seller of this order"; a miss
        // collapses to NotFound so we don't leak whether the file exists.
        const meta = await this.ordersRepo.getDeliveryFileForResolve(orderId, deliveryId, fileId, user.local.dbId)
        if (!meta) throw new NotFoundException('Delivery file not found')

        const forDownload = downloadFlag === '1' || downloadFlag === 'true'
        const url = await this.deliveryStorage.presignGetUrl(
            meta.key,
            DELIVERY_PRESIGN_TTL_S,
            forDownload ? meta.name : undefined
        )
        const dto = validateAndTransform(DeliveryFileUrlResponseDto, {
            url,
            name: meta.name
        })
        return createResponse(
            RESPONSE_CODES.ORDERS_DELIVERY_FILE_RESOLVE_SUCCESS,
            RESPONSE_TYPES.ORDERS_DELIVERY_FILE_RESOLVE,
            MESSAGES.ORDERS.DELIVERY_FILE_RESOLVED,
            dto
        )
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private async resolveAvatarKey(key: string | null): Promise<string | null> {
        if (!key) return null
        try {
            return await this.imageStorage.getSignedReadUrl(key)
        } catch {
            return null
        }
    }

    private async toDetailDto(order: OrderDetail): Promise<OrderDetailResponseDto> {
        const [buyerAvatarUrl, sellerAvatarUrl, gigCoverUrl] = await Promise.all([
            this.resolveAvatarKey(order.buyer.avatarKey),
            this.resolveAvatarKey(order.seller.avatarKey),
            this.resolveAvatarKey(order.gig.coverKey)
        ])

        return validateAndTransform(OrderDetailResponseDto, {
            id: order.id,
            code: formatOrderCode(order.number),
            number: order.number,
            status: order.status,
            buyer: {
                id: order.buyer.id,
                username: order.buyer.username,
                displayName: order.buyer.displayName,
                avatarUrl: buyerAvatarUrl,
                endorsedAt: order.buyer.endorsedAt ? order.buyer.endorsedAt.toISOString() : null
            },
            seller: {
                id: order.seller.id,
                username: order.seller.username,
                displayName: order.seller.displayName,
                avatarUrl: sellerAvatarUrl,
                endorsedAt: order.seller.endorsedAt ? order.seller.endorsedAt.toISOString() : null
            },
            gig: {
                id: order.gig.id,
                title: order.gig.titleSnapshot,
                priceVnd: order.gig.priceVndSnapshot,
                deliveryDays: order.gig.deliveryDays,
                coverUrl: gigCoverUrl
            },
            placedAt: order.placedAt.toISOString(),
            acceptedAt: order.acceptedAt?.toISOString() ?? null,
            deliveredAt: order.deliveredAt?.toISOString() ?? null,
            completedAt: order.completedAt?.toISOString() ?? null,
            cancelledAt: order.cancelledAt?.toISOString() ?? null,
            autoCompletedAt: order.autoCompletedAt?.toISOString() ?? null,
            acceptDeadline: order.acceptDeadline?.toISOString() ?? null,
            deliveryDeadline: order.deliveryDeadline?.toISOString() ?? null,
            reviewDeadline: order.reviewDeadline?.toISOString() ?? null,
            disputeDeadline: order.disputeDeadline?.toISOString() ?? null,
            cancelledByUserId: order.cancelledByUserId,
            cancellationReason: order.cancellationReason,
            latestDelivery: order.latestDelivery ? this.toDeliveryDto(order.latestDelivery) : null,
            pendingExtension: order.pendingExtension
                ? {
                      ...order.pendingExtension,
                      expiresAt: order.pendingExtension.expiresAt.toISOString(),
                      requestedAt: order.pendingExtension.requestedAt.toISOString(),
                      decidedAt: order.pendingExtension.decidedAt?.toISOString() ?? null
                  }
                : null,
            pendingCancellation: order.pendingCancellation
                ? {
                      ...order.pendingCancellation,
                      expiresAt: order.pendingCancellation.expiresAt.toISOString(),
                      requestedAt: order.pendingCancellation.requestedAt.toISOString(),
                      decidedAt: order.pendingCancellation.decidedAt?.toISOString() ?? null
                  }
                : null,
            deliveryCount: order.deliveryCount
        })
    }

    private toDeliveryDto(d: DeliveryItem): DeliveryResponseDto {
        return validateAndTransform(DeliveryResponseDto, {
            id: d.id,
            orderId: d.orderId,
            version: d.version,
            note: d.note,
            deliveredAt: d.deliveredAt.toISOString(),
            files: d.files.map((f) => ({
                id: f.id,
                name: f.name,
                size: f.size,
                mime: f.mime,
                createdAt: f.createdAt.toISOString()
            }))
        })
    }

    // Returns a plain object (NOT a class instance). When the TransformInterceptor
    // serializes the response, plain objects pass straight through to
    // snakecaseKeys — nested class instances would get tangled in instanceToPlain
    // and emit empty objects in arrays. The validateAndTransform safety net is
    // sacrificed for correctness; the shape is exercised by E2E tests.
    private async toListRowDto(row: OrderListRow): Promise<OrderListRowResponseDto> {
        const [counterpartyAvatarUrl, gigCoverUrl] = await Promise.all([
            this.resolveAvatarKey(row.counterpartyAvatarKey),
            this.resolveAvatarKey(row.gigCoverKey)
        ])
        return {
            id: row.id,
            code: formatOrderCode(row.number),
            number: row.number,
            status: row.status,
            gigTitle: row.gigTitle,
            gigCoverUrl,
            counterpartyId: row.counterpartyId,
            counterpartyDisplayName: row.counterpartyDisplayName,
            counterpartyUsername: row.counterpartyUsername,
            counterpartyAvatarUrl,
            placedAt: row.placedAt.toISOString(),
            amountVnd: row.amountVnd,
            acceptDeadline: row.acceptDeadline?.toISOString() ?? null,
            deliveryDeadline: row.deliveryDeadline?.toISOString() ?? null,
            reviewDeadline: row.reviewDeadline?.toISOString() ?? null,
            disputeDeadline: row.disputeDeadline?.toISOString() ?? null,
            pendingExtensionExpiresAt: row.pendingExtensionExpiresAt?.toISOString() ?? null,
            pendingCancellationExpiresAt: row.pendingCancellationExpiresAt?.toISOString() ?? null,
            pendingCancellationInitiator: row.pendingCancellationInitiator,
            actionRequired: row.actionRequired
        } as OrderListRowResponseDto
    }
}
