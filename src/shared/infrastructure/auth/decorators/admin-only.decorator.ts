import { applyDecorators } from '@nestjs/common'
import { Roles } from './roles.decorator'

/**
 * Marks an endpoint (or entire controller) as admin-only.
 *
 * Implementation note: the global `RolesGuard` (registered in `AppModule`) reads
 * the `@Roles(...)` metadata from the handler/class and enforces the role check
 * against `realm_access.roles` on the authenticated JWT. We expose `@AdminOnly()`
 * as a sugar over `@Roles('admin')` so every admin module reads as `@AdminOnly()`
 * — clearer intent, single source of truth if we ever rename the role.
 */
export const AdminOnly = () => applyDecorators(Roles('admin'))
