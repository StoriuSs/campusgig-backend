import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'

import { USER_REPOSITORY_PORT, UserEntity, UserRepositoryPort } from '@/modules/users/domain'

import { UpdateEmailPreferencesCommand } from './update-email-preferences.command'

@CommandHandler(UpdateEmailPreferencesCommand)
export class UpdateEmailPreferencesHandler implements ICommandHandler<UpdateEmailPreferencesCommand> {
    constructor(@Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort) {}

    execute(command: UpdateEmailPreferencesCommand): Promise<UserEntity> {
        const { prefs } = command
        const update: Partial<UserEntity> = {}
        if (prefs.emailNotificationsEnabled !== undefined)
            update.emailNotificationsEnabled = prefs.emailNotificationsEnabled
        if (prefs.emailOrders !== undefined) update.emailOrders = prefs.emailOrders
        if (prefs.emailDisputes !== undefined) update.emailDisputes = prefs.emailDisputes
        if (prefs.emailGigs !== undefined) update.emailGigs = prefs.emailGigs
        return this.userRepo.update(command.userId, update)
    }
}
