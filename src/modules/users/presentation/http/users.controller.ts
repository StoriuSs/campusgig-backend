import {
    Controller,
    Get,
    Body,
    Patch,
    Post,
    Delete,
    Param,
    UseInterceptors,
    UploadedFile,
    HttpCode,
    HttpStatus,
    ParseFilePipe
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { CommandBus, QueryBus } from '@nestjs/cqrs'

// Presentation DTOs
import {
    UpdateProfileRequestDto,
    SetUsernameRequestDto,
    UserProfileResponseDto,
    UpdateProfileResponseDto,
    SetUsernameResponseDto,
    UploadAvatarResponseDto
} from './dto'

// Commands & Queries
import { UpdateProfileCommand } from '@/modules/users/application'
import { SetUsernameCommand } from '@/modules/users/application'
import { UploadAvatarCommand } from '@/modules/users/application'
import { DeleteAccountCommand } from '@/modules/users/application'
import { CheckUsernameQuery } from '@/modules/users/application'
import { UploadAvatarResult } from '@/modules/users/application'

// Shared
import { CurrentUser, Idempotent } from '@/shared/presentation/decorators'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform, getFullUrl } from '@/shared/utils'
import { StoragePort, STORAGE_PORT } from '@/modules/users/application'
import { Inject } from '@nestjs/common'
import { UserEntity } from '@/modules/users/domain'

@Controller({ path: 'users', version: '1' })
export class UsersController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly configService: ConfigService,
        @Inject(STORAGE_PORT) private readonly storage: StoragePort
    ) {}

    /**
     * Get current user profile
     * Combines Keycloak user info with local database preferences
     * Note: User is already synced to DB by KeycloakAuthGuard (JIT provisioning)
     */
    @Get('me')
    @HttpCode(HttpStatus.OK)
    async getProfile(@CurrentUser() user: AuthenticatedKeycloakUser): Promise<ServiceResponse<UserProfileResponseDto>> {
        const profile = validateAndTransform(UserProfileResponseDto, {
            id: user.id,
            email: user.email,
            username: user.local.username ?? user.username,
            displayName: user.local.displayName ?? user.name,
            avatarUrl: user.local.avatarUrl
                ? getFullUrl(
                      this.storage.getPublicUrl(user.local.avatarUrl),
                      this.configService.get<string>('app.baseUrl')
                  )
                : null,
            emailVerified: user.emailVerified,
            roles: user.roles,
            bio: user.local.bio,
            hasSetUsername: user.local.hasSetUsername
        })

        return createResponse(
            RESPONSE_CODES.USER_FETCH_SUCCESS,
            RESPONSE_TYPES.USER_FETCH,
            MESSAGES.USER.FETCHED,
            profile
        )
    }

    @Post('me/username')
    @HttpCode(HttpStatus.OK)
    @Idempotent('1h') // Protect against double-submissions when setting username
    async setUsername(@CurrentUser() user: AuthenticatedKeycloakUser, @Body() dto: SetUsernameRequestDto) {
        const result: UserEntity = await this.commandBus.execute(new SetUsernameCommand(user.local.dbId, dto.username))

        const responseData = validateAndTransform(SetUsernameResponseDto, {
            username: result.username,
            hasSetUsername: result.hasSetUsername
        })

        return createResponse(
            RESPONSE_CODES.USER_UPDATE_SUCCESS,
            RESPONSE_TYPES.USER_UPDATE,
            MESSAGES.USER.USERNAME_SET_SUCCESS,
            responseData
        )
    }

    @Get('username-available/:username')
    @HttpCode(HttpStatus.OK)
    async checkUsernameAvailability(
        @Param('username') username: string
    ): Promise<ServiceResponse<{ available: boolean }>> {
        const available: boolean = await this.queryBus.execute(new CheckUsernameQuery(username))
        return createResponse(
            RESPONSE_CODES.SUCCESS,
            RESPONSE_TYPES.SUCCESS,
            available ? 'Username is available' : 'Username is taken',
            { available }
        )
    }

    @Patch('me')
    @HttpCode(HttpStatus.OK)
    @Idempotent('1h') // Prevent duplicate database updates
    async updateProfile(@CurrentUser() user: AuthenticatedKeycloakUser, @Body() dto: UpdateProfileRequestDto) {
        const result: UserEntity = await this.commandBus.execute(
            new UpdateProfileCommand(user.local.dbId, dto.displayName, dto.bio)
        )

        const responseData = validateAndTransform(UpdateProfileResponseDto, {
            username: result.username,
            displayName: result.displayName,
            avatarUrl: result.avatarUrl
                ? getFullUrl(this.storage.getPublicUrl(result.avatarUrl), this.configService.get<string>('app.baseUrl'))
                : null,
            bio: result.bio,
            hasSetUsername: result.hasSetUsername
        })

        return createResponse(
            RESPONSE_CODES.USER_UPDATE_SUCCESS,
            RESPONSE_TYPES.USER_UPDATE,
            MESSAGES.USER.PROFILE_UPDATED,
            responseData
        )
    }

    @Post('me/avatar')
    @HttpCode(HttpStatus.OK)
    @Idempotent('1h') // Prevent double file uploads
    @UseInterceptors(
        FileInterceptor('avatar', {
            storage: memoryStorage()
        })
    )
    async uploadAvatar(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @UploadedFile(
            new ParseFilePipe({
                fileIsRequired: true
            })
        )
        file: Express.Multer.File
    ) {
        const result: UploadAvatarResult = await this.commandBus.execute(
            new UploadAvatarCommand(user.local.dbId, file.buffer, file.originalname)
        )

        const responseData = validateAndTransform(UploadAvatarResponseDto, {
            avatarUrl: getFullUrl(
                this.storage.getPublicUrl(result.upload.key),
                this.configService.get<string>('app.baseUrl')
            ),
            width: result.upload.width,
            height: result.upload.height,
            uploadedAt: new Date().toISOString()
        })

        return createResponse(
            RESPONSE_CODES.UPLOAD_FILE_SUCCESS,
            RESPONSE_TYPES.UPLOAD_FILE,
            MESSAGES.UPLOAD.SUCCESS,
            responseData
        )
    }

    @Delete('me')
    @HttpCode(HttpStatus.OK)
    @Idempotent('24h') // Account deletion is highly sensitive; lock for 24h
    async deleteAccount(@CurrentUser() user: AuthenticatedKeycloakUser) {
        await this.commandBus.execute(new DeleteAccountCommand(user.local.dbId, user.local.dbId))

        return createResponse(
            RESPONSE_CODES.USER_DELETE_SUCCESS,
            RESPONSE_TYPES.USER_DELETE,
            MESSAGES.USER.ACCOUNT_DELETED,
            null
        )
    }
}
