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
    UploadedFile,
    UseInterceptors
} from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import {
    DELIVERY_STORAGE_PORT,
    DeliveryStoragePort,
    ORDERS_REPOSITORY_PORT,
    OrdersRepositoryPort
} from '@/modules/orders/domain/ports'

import {
    AddDisputeEvidenceCommand,
    FileDisputeCommand,
    RespondToDisputeCommand,
    UploadEvidenceFileCommand
} from '../../application'
import {
    DISPUTES_REPOSITORY_PORT,
    DisputeEvidenceItem,
    DisputesRepositoryPort
} from '../../domain/ports/disputes.repository.port'
import { DisputeReasonCode } from '../../domain/dispute.types'
import { NotAParticipantException, DisputeNotFoundException } from '../../domain/exceptions'
import {
    AddEvidenceRequestDto,
    EvidenceUrlResponseDto,
    FileDisputeRequestDto,
    RespondDisputeRequestDto,
    StagedEvidenceResponseDto
} from './dto'

const EVIDENCE_URL_TTL = 3600

@ApiTags('Disputes')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'orders', version: '1' })
export class DisputesController {
    constructor(
        private readonly commandBus: CommandBus,
        @Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort,
        @Inject(ORDERS_REPOSITORY_PORT) private readonly ordersRepo: OrdersRepositoryPort,
        @Inject(DELIVERY_STORAGE_PORT) private readonly storage: DeliveryStoragePort
    ) {}

    @Post(':orderId/dispute')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'File a dispute on an order (freezes it, opens the 48h response window)' })
    @ApiResponse({ status: 200, description: 'Dispute filed' })
    async file(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId') orderId: string,
        @Body() dto: FileDisputeRequestDto
    ): Promise<ServiceResponse<null>> {
        await this.commandBus.execute(
            new FileDisputeCommand(
                orderId,
                user.local.dbId,
                dto.reasonCode as DisputeReasonCode,
                dto.statement,
                dto.evidenceFileIds ?? []
            )
        )
        return createResponse(
            RESPONSE_CODES.DISPUTE_FILE_SUCCESS,
            RESPONSE_TYPES.DISPUTE_FILE,
            MESSAGES.DISPUTE.FILED,
            null
        )
    }

    @Post(':orderId/dispute/response')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Respond to a dispute (counterparty)' })
    async respond(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId') orderId: string,
        @Body() dto: RespondDisputeRequestDto
    ): Promise<ServiceResponse<null>> {
        await this.commandBus.execute(
            new RespondToDisputeCommand(orderId, user.local.dbId, dto.statement, dto.evidenceFileIds ?? [])
        )
        return createResponse(
            RESPONSE_CODES.DISPUTE_RESPOND_SUCCESS,
            RESPONSE_TYPES.DISPUTE_RESPOND,
            MESSAGES.DISPUTE.RESPONDED,
            null
        )
    }

    @Post(':orderId/dispute/evidence')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Attach more evidence to an open dispute (either party)' })
    async addEvidence(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId') orderId: string,
        @Body() dto: AddEvidenceRequestDto
    ): Promise<ServiceResponse<null>> {
        await this.commandBus.execute(new AddDisputeEvidenceCommand(orderId, user.local.dbId, dto.evidenceFileIds))
        return createResponse(
            RESPONSE_CODES.DISPUTE_ADD_EVIDENCE_SUCCESS,
            RESPONSE_TYPES.DISPUTE_ADD_EVIDENCE,
            MESSAGES.DISPUTE.EVIDENCE_ADDED,
            null
        )
    }

    @Post(':orderId/dispute/evidence/upload')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    @ApiOperation({ summary: 'Stage a dispute evidence file (returns its id for file/respond/add-evidence)' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 201, type: StagedEvidenceResponseDto })
    async uploadEvidence(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId') orderId: string,
        @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File
    ): Promise<ServiceResponse<StagedEvidenceResponseDto>> {
        // Same Vietnamese / CJK rescue as messaging & deliveries — Multer hands us
        // Latin-1 bytes for the original filename even though the wire encoding is
        // UTF-8, so non-ASCII names ("công" → "cÃ´ng") arrive mojibake'd.
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
        const staged: DisputeEvidenceItem = await this.commandBus.execute(
            new UploadEvidenceFileCommand(orderId, user.local.dbId, originalName, file.mimetype, file.buffer)
        )
        const dto = validateAndTransform(StagedEvidenceResponseDto, {
            id: staged.id,
            side: staged.side,
            name: staged.name,
            size: staged.size,
            mime: staged.mime,
            createdAt: staged.createdAt.toISOString()
        })
        return createResponse(
            RESPONSE_CODES.DISPUTE_EVIDENCE_UPLOAD_SUCCESS,
            RESPONSE_TYPES.DISPUTE_EVIDENCE_UPLOAD,
            MESSAGES.DISPUTE.EVIDENCE_UPLOADED,
            dto
        )
    }

    @Get(':orderId/dispute/evidence/:evidenceId/url')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Presigned URL for a dispute evidence file (participant only)',
        description: 'Pass ?download=1 to force Save As instead of an inline preview.'
    })
    @ApiResponse({ status: 200, type: EvidenceUrlResponseDto })
    async evidenceUrl(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId') orderId: string,
        @Param('evidenceId') evidenceId: string,
        @Query('download') downloadFlag?: string
    ): Promise<ServiceResponse<EvidenceUrlResponseDto>> {
        const order = await this.ordersRepo.findByIdForViewer(orderId, user.local.dbId)
        if (!order) throw new NotAParticipantException(orderId)
        const ev = await this.repo.findEvidenceFile(evidenceId)
        if (!ev || ev.orderId !== orderId) throw new DisputeNotFoundException(orderId)
        const forDownload = downloadFlag === '1' || downloadFlag === 'true'
        const url = forDownload
            ? await this.storage.presignGetUrl(ev.key, EVIDENCE_URL_TTL, ev.name)
            : await this.storage.presignGetUrl(ev.key, EVIDENCE_URL_TTL)
        const dto = validateAndTransform(EvidenceUrlResponseDto, { url })
        return createResponse(
            RESPONSE_CODES.DISPUTE_EVIDENCE_URL_SUCCESS,
            RESPONSE_TYPES.DISPUTE_EVIDENCE_URL,
            MESSAGES.DISPUTE.EVIDENCE_URL,
            dto
        )
    }
}
