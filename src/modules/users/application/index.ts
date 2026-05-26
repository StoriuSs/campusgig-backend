// Export all ports
export * from './ports'

// Export all commands
export * from './commands/update-profile/update-profile.command'
export * from './commands/update-profile/update-profile.handler'
export * from './commands/set-username/set-username.command'
export * from './commands/set-username/set-username.handler'
export * from './commands/upload-avatar/upload-avatar.command'
export * from './commands/upload-avatar/upload-avatar.handler'
export * from './commands/delete-account/delete-account.command'
export * from './commands/delete-account/delete-account.handler'
export * from './commands/add-skill/add-skill.command'
export * from './commands/add-skill/add-skill.handler'
export * from './commands/remove-skill/remove-skill.command'
export * from './commands/remove-skill/remove-skill.handler'
export * from './commands/add-portfolio-item/add-portfolio-item.command'
export * from './commands/add-portfolio-item/add-portfolio-item.handler'
export * from './commands/remove-portfolio-item/remove-portfolio-item.command'
export * from './commands/remove-portfolio-item/remove-portfolio-item.handler'

// Export all queries
export * from './queries/check-username/check-username.query'
export * from './queries/check-username/check-username.handler'
export * from './queries/get-public-profile-by-username/get-public-profile-by-username.query'
export * from './queries/get-public-profile-by-username/get-public-profile-by-username.handler'

// Export all events
export * from './events/account-deleted.event'
export * from './events/avatar-uploaded.event'
export * from './events/user-profile-updated.event'
export * from './events/portfolio-item-deleted.event'

// Export all event handlers
export * from './events/handlers/cleanup-old-avatar.handler'
export * from './events/handlers/enqueue-keycloak-delete.handler'
export * from './events/handlers/invalidate-cache.handler'
export * from './events/handlers/cleanup-portfolio-image.handler'
