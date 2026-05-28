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
    ParseFilePipe,
    NotFoundException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger'

// Presentation DTOs
import {
    UpdateProfileRequestDto,
    SetUsernameRequestDto,
    AddSkillRequestDto,
    UserProfileResponseDto,
    UpdateProfileResponseDto,
    SetUsernameResponseDto,
    UploadAvatarResponseDto,
    PublicProfileResponseDto,
    SkillResponseDto,
    PortfolioItemResponseDto
} from './dto'

// Commands & Queries
import {
    UpdateProfileCommand,
    SetUsernameCommand,
    UploadAvatarCommand,
    DeleteAccountCommand,
    AddSkillCommand,
    RemoveSkillCommand,
    AddPortfolioItemCommand,
    RemovePortfolioItemCommand,
    CheckUsernameQuery,
    GetPublicProfileByUsernameQuery,
    UploadAvatarResult
} from '@/modules/users/application'

// Shared
import { CurrentUser, Idempotent, Public } from '@/shared/presentation/decorators'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform, getFullUrl } from '@/shared/utils'
import { StoragePort, STORAGE_PORT } from '@/modules/users/application'
import { Inject } from '@nestjs/common'
import {
    UserEntity,
    UserSkillEntity,
    PortfolioItemEntity,
    UserWithRelations,
    USER_REPOSITORY_PORT,
    UserRepositoryPort,
    UserNotFoundException
} from '@/modules/users/domain'

@ApiTags('Users')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'users', version: '1' })
export class UsersController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly configService: ConfigService,
        @Inject(STORAGE_PORT) private readonly storage: StoragePort,
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort
    ) {}

    @Get('me')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get current user profile',
        description: "Returns the authenticated user's full profile including skills and portfolio items."
    })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully', type: UserProfileResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getProfile(@CurrentUser() user: AuthenticatedKeycloakUser): Promise<ServiceResponse<UserProfileResponseDto>> {
        const bundle = await this.userRepo.findWithRelations(user.local.dbId)
        if (!bundle) {
            throw new UserNotFoundException(user.local.dbId)
        }

        const avatarUrl = await this.resolveImageUrl(bundle.user.avatarUrl)
        const portfolioItems = await this.resolvePortfolioItems(bundle.portfolioItems)

        const profile = validateAndTransform(UserProfileResponseDto, {
            id: bundle.user.id,
            email: user.email,
            username: bundle.user.username ?? user.username,
            displayName: bundle.user.displayName ?? user.name,
            avatarUrl,
            emailVerified: user.emailVerified,
            roles: user.roles,
            bio: bundle.user.bio,
            hasSetUsername: bundle.user.hasSetUsername,
            location: bundle.user.location,
            roleLine: bundle.user.roleLine,
            languages: bundle.user.languages,
            endorsed: bundle.user.isEndorsed,
            memberSince: bundle.user.createdAt.toISOString(),
            skills: bundle.skills.map((s) => this.mapSkill(s)),
            portfolioItems,
            isAdmin: bundle.user.isAdmin
        })

        return createResponse(
            RESPONSE_CODES.USER_FETCH_SUCCESS,
            RESPONSE_TYPES.USER_FETCH,
            MESSAGES.USER.FETCHED,
            profile
        )
    }

    @Public()
    @Get('by-username/:username')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get public profile by username',
        description:
            'Public endpoint — no auth required. Returns profile without private fields (email, roles, hasSetUsername).'
    })
    @ApiParam({ name: 'username', description: 'Case-insensitive username' })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully', type: PublicProfileResponseDto })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getPublicProfileByUsername(
        @Param('username') username: string
    ): Promise<ServiceResponse<PublicProfileResponseDto>> {
        const bundle: UserWithRelations = await this.queryBus.execute(new GetPublicProfileByUsernameQuery(username))

        const avatarUrl = await this.resolveImageUrl(bundle.user.avatarUrl)
        const portfolioItems = await this.resolvePortfolioItems(bundle.portfolioItems)

        const profile = validateAndTransform(PublicProfileResponseDto, {
            id: bundle.user.id,
            username: bundle.user.username,
            displayName: bundle.user.displayName,
            avatarUrl,
            bio: bundle.user.bio,
            location: bundle.user.location,
            roleLine: bundle.user.roleLine,
            languages: bundle.user.languages,
            endorsed: bundle.user.isEndorsed,
            memberSince: bundle.user.createdAt.toISOString(),
            skills: bundle.skills.map((s) => this.mapSkill(s)),
            portfolioItems
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
    @Idempotent('1h')
    @ApiOperation({
        summary: 'Set username (one-time)',
        description: 'Sets the username for the first time. Cannot be changed after this.'
    })
    @ApiResponse({ status: 200, description: 'Username set successfully', type: SetUsernameResponseDto })
    @ApiResponse({ status: 409, description: 'Username already taken' })
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

    @Public()
    @Get('username-available/:username')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Check username availability' })
    @ApiParam({ name: 'username', description: 'Username to check' })
    @ApiResponse({ status: 200, description: 'Returns { available: boolean }' })
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
    @Idempotent('1h')
    @ApiOperation({
        summary: 'Update profile',
        description: 'Updates display name, bio, role line, location, and languages. All fields are optional.'
    })
    @ApiResponse({ status: 200, description: 'Profile updated successfully', type: UpdateProfileResponseDto })
    async updateProfile(@CurrentUser() user: AuthenticatedKeycloakUser, @Body() dto: UpdateProfileRequestDto) {
        const result: UserEntity = await this.commandBus.execute(
            new UpdateProfileCommand(
                user.local.dbId,
                dto.displayName,
                dto.bio,
                dto.location,
                dto.roleLine,
                dto.languages
            )
        )

        const avatarUrl = await this.resolveImageUrl(result.avatarUrl)
        const responseData = validateAndTransform(UpdateProfileResponseDto, {
            username: result.username,
            displayName: result.displayName,
            avatarUrl,
            bio: result.bio,
            location: result.location,
            roleLine: result.roleLine,
            languages: result.languages,
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
    @Idempotent('1h')
    @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
    @ApiOperation({
        summary: 'Upload avatar',
        description: 'Uploads and crops the user avatar. Accepts JPEG, PNG, or WebP up to 5 MB.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { avatar: { type: 'string', format: 'binary' } } } })
    @ApiResponse({ status: 200, description: 'Avatar uploaded successfully', type: UploadAvatarResponseDto })
    async uploadAvatar(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File
    ) {
        const result: UploadAvatarResult = await this.commandBus.execute(
            new UploadAvatarCommand(user.local.dbId, file.buffer, file.originalname)
        )

        const avatarUrl = await this.resolveImageUrl(result.upload.key)
        const responseData = validateAndTransform(UploadAvatarResponseDto, {
            avatarUrl,
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

    // ────────────────────────────────────────────────────────────────────
    // Skills
    // ────────────────────────────────────────────────────────────────────

    @Post('me/skills')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Add skill', description: 'Adds a skill tag to the user profile. Maximum 10 skills.' })
    @ApiResponse({ status: 201, description: 'Skill added', type: SkillResponseDto })
    @ApiResponse({ status: 409, description: 'Skill cap (10) reached' })
    async addSkill(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Body() dto: AddSkillRequestDto
    ): Promise<ServiceResponse<SkillResponseDto>> {
        const created: UserSkillEntity = await this.commandBus.execute(new AddSkillCommand(user.local.dbId, dto.name))

        return createResponse(
            RESPONSE_CODES.USER_UPDATE_SUCCESS,
            RESPONSE_TYPES.USER_UPDATE,
            MESSAGES.USER.PROFILE_UPDATED,
            this.mapSkill(created)
        )
    }

    @Delete('me/skills/:skillId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove skill' })
    @ApiParam({ name: 'skillId', description: 'UUID of the skill to remove' })
    @ApiResponse({ status: 204, description: 'Skill removed' })
    @ApiResponse({ status: 404, description: 'Skill not found or does not belong to user' })
    async removeSkill(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('skillId') skillId: string
    ): Promise<void> {
        await this.commandBus.execute(new RemoveSkillCommand(user.local.dbId, skillId))
    }

    // ────────────────────────────────────────────────────────────────────
    // Portfolio
    // ────────────────────────────────────────────────────────────────────

    @Post('me/portfolio')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
    @ApiOperation({
        summary: 'Upload portfolio image',
        description: 'Uploads a portfolio image. Accepts JPEG, PNG, or WebP up to 5 MB. Maximum 9 items.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
    @ApiResponse({ status: 201, description: 'Portfolio item added', type: PortfolioItemResponseDto })
    @ApiResponse({ status: 409, description: 'Portfolio cap (9) reached' })
    async uploadPortfolioItem(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File
    ): Promise<ServiceResponse<PortfolioItemResponseDto>> {
        const created: PortfolioItemEntity = await this.commandBus.execute(
            new AddPortfolioItemCommand(user.local.dbId, file.buffer, file.originalname)
        )

        const imageUrl = await this.resolveImageUrl(created.imageKey)
        if (!imageUrl) {
            throw new NotFoundException('Uploaded portfolio image could not be resolved.')
        }

        const response = validateAndTransform(PortfolioItemResponseDto, {
            id: created.id,
            imageUrl,
            width: created.width,
            height: created.height,
            position: created.position
        })

        return createResponse(
            RESPONSE_CODES.UPLOAD_FILE_SUCCESS,
            RESPONSE_TYPES.UPLOAD_FILE,
            MESSAGES.UPLOAD.SUCCESS,
            response
        )
    }

    @Delete('me/portfolio/:itemId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete portfolio item' })
    @ApiParam({ name: 'itemId', description: 'UUID of the portfolio item to delete' })
    @ApiResponse({ status: 204, description: 'Portfolio item deleted' })
    @ApiResponse({ status: 404, description: 'Item not found or does not belong to user' })
    async removePortfolioItem(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('itemId') itemId: string
    ): Promise<void> {
        await this.commandBus.execute(new RemovePortfolioItemCommand(user.local.dbId, itemId))
    }

    // ────────────────────────────────────────────────────────────────────
    // Account
    // ────────────────────────────────────────────────────────────────────

    @Delete('me')
    @HttpCode(HttpStatus.OK)
    @Idempotent('24h')
    @ApiOperation({ summary: 'Delete account', description: 'Soft-deletes the account. Irreversible via API.' })
    @ApiResponse({ status: 200, description: 'Account deleted' })
    async deleteAccount(@CurrentUser() user: AuthenticatedKeycloakUser) {
        await this.commandBus.execute(new DeleteAccountCommand(user.local.dbId, user.local.dbId))

        return createResponse(
            RESPONSE_CODES.USER_DELETE_SUCCESS,
            RESPONSE_TYPES.USER_DELETE,
            MESSAGES.USER.ACCOUNT_DELETED,
            null
        )
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────

    private async resolveImageUrl(key: string | null | undefined): Promise<string | null> {
        if (!key) return null
        const url = await this.storage.getSignedReadUrl(key)
        return getFullUrl(url, this.configService.get<string>('app.baseUrl'))
    }

    private async resolvePortfolioItems(items: PortfolioItemEntity[]): Promise<PortfolioItemResponseDto[]> {
        return Promise.all(
            items.map(async (item) => {
                const imageUrl = await this.resolveImageUrl(item.imageKey)
                return {
                    id: item.id,
                    imageUrl: imageUrl ?? '',
                    width: item.width,
                    height: item.height,
                    position: item.position
                }
            })
        )
    }

    private mapSkill(skill: UserSkillEntity): SkillResponseDto {
        return {
            id: skill.id,
            name: skill.name,
            position: skill.position
        }
    }
}
