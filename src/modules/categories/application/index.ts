export * from './commands/create-category/create-category.command'
export * from './commands/create-category/create-category.handler'
export * from './commands/update-category/update-category.command'
export * from './commands/update-category/update-category.handler'
export * from './commands/delete-category/delete-category.command'
export * from './commands/delete-category/delete-category.handler'
export * from './queries/list-categories/list-categories.query'
export * from './queries/list-categories/list-categories.handler'
export * from './queries/list-all-categories/list-all-categories.query'
export * from './queries/list-all-categories/list-all-categories.handler'
export * from './queries/list-all-categories-with-count/list-all-categories-with-count.query'
export * from './queries/list-all-categories-with-count/list-all-categories-with-count.handler'

// Feature 04 — domain events emitted by category mutations.
// Used by the public-list cache invalidation handler in the categories module
// and potentially by Feature 06 (Browse) for cache busting.
export * from './events/category-created.event'
export * from './events/category-updated.event'
export * from './events/category-deleted.event'
export * from './events/handlers/invalidate-public-categories-cache.handler'
