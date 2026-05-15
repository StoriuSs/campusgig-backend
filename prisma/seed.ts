import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seed the database with example data.
 * 
 * Run with: npm run prisma:seed
 * 
 * NOTE: In a Keycloak-integrated app, users are typically created when they
 * first authenticate. This seed file is primarily for:
 * - Development/testing with pre-populated data
 * - Demo environments
 * - Integration tests
 */
async function main() {
    console.log('🌱 Starting database seed...')

    // Example: Create demo users
    // These keycloakIds should match test users in your Keycloak realm
    const users = await prisma.user.createMany({
        data: [
            {
                keycloakId: 'demo-user-001',
                username: 'johndoe',
                displayName: 'John Doe',
                bio: 'Full-stack developer passionate about clean code.',
                hasSetUsername: true,
            },
            {
                keycloakId: 'demo-user-002',
                username: 'janedoe',
                displayName: 'Jane Doe',
                bio: 'UX designer and accessibility advocate.',
                hasSetUsername: true,
            },
            {
                keycloakId: 'demo-admin-001',
                username: 'admin',
                displayName: 'Admin User',
                bio: 'System administrator.',
                hasSetUsername: true,
            },
        ],
        skipDuplicates: true, // Skip if keycloakId already exists
    })

    console.log(`✅ Created ${users.count} users`)
    console.log('🌱 Database seed completed!')
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
