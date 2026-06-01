// Types + port only — intentionally does NOT re-export AdminActivityModule, so
// importing the port token (e.g. into a handler) doesn't drag the Prisma-backed
// repository into unit-test import graphs. Import the module from its own path.
export * from './domain/admin-activity.types'
export * from './domain/ports/admin-activity.repository.port'
