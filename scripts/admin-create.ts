/**
 * Admin creation script — Feature 03.
 *
 * Usage:
 *   pnpm admin:create --email admin@campusgig.local --displayName "Admin User"
 *
 * What it does:
 *   1. Authenticates against Keycloak master realm as the bootstrap admin
 *      (KEYCLOAK_ADMIN_USER/PASSWORD), same pattern as the running app.
 *   2. Ensures the `admin` realm role exists in the target realm (KEYCLOAK_REALM).
 *      Creates it if missing.
 *   3. Creates a new user in the target realm with email, displayName, a random
 *      24-character password, emailVerified=true.
 *   4. Assigns the `admin` realm role to that user.
 *   5. Prints the credentials to stdout once. Caller must capture or note them —
 *      they are not stored anywhere.
 *
 * The local DB User row is NOT created here. It's JIT-provisioned by
 * `KeycloakAuthGuard.syncUserToDatabase` on the admin's first authenticated
 * request — which sets isAdmin=true + hasSetUsername=true from the JWT roles.
 *
 * Required env vars (read from .env.development by the dotenv wrapper):
 *   KEYCLOAK_HOST, KEYCLOAK_PORT, KEYCLOAK_REALM,
 *   KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD
 */

import KcAdminClient from '@keycloak/keycloak-admin-client'
import { randomBytes } from 'crypto'

const ADMIN_ROLE_NAME = 'admin'

interface ParsedArgs {
    email: string
    displayName: string
}

function parseArgs(argv: string[]): ParsedArgs {
    const args: Partial<ParsedArgs> = {}
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i]
        const value = argv[i + 1]
        if (flag === '--email' && value) {
            args.email = value
            i++
        } else if (flag === '--displayName' && value) {
            args.displayName = value
            i++
        }
    }
    if (!args.email || !args.displayName) {
        console.error(
            'Usage: pnpm admin:create --email <email> --displayName "<name>"\n' +
                '  --email        Required. Login email for the admin account.\n' +
                '  --displayName  Required. Shown in the admin avatar menu.'
        )
        process.exit(1)
    }
    return args as ParsedArgs
}

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        console.error(
            `Missing required env var: ${name}\n` +
                `Required: KEYCLOAK_HOST, KEYCLOAK_PORT, KEYCLOAK_REALM, KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD\n` +
                `Did you run via "pnpm admin:create" (which loads .env.development)?`
        )
        process.exit(1)
    }
    return value
}

function generatePassword(): string {
    // 24-char base64url. Crypto-strong; printable; no special-character escaping needed.
    return randomBytes(18).toString('base64url')
}

async function ensureAdminRoleExists(kc: KcAdminClient, realm: string): Promise<void> {
    const existing = await kc.roles.findOneByName({ realm, name: ADMIN_ROLE_NAME })
    if (existing) {
        return
    }
    await kc.roles.create({
        realm,
        name: ADMIN_ROLE_NAME,
        description: 'CampusGig platform administrator. Grants access to /admin/*.'
    })
    console.log(`Created missing realm role "${ADMIN_ROLE_NAME}" in realm "${realm}".`)
}

async function main(): Promise<void> {
    const { email, displayName } = parseArgs(process.argv.slice(2))

    const keycloakHost = requireEnv('KEYCLOAK_HOST')
    const keycloakPort = requireEnv('KEYCLOAK_PORT')
    const realm = requireEnv('KEYCLOAK_REALM')
    const adminUser = requireEnv('KEYCLOAK_ADMIN_USER')
    const adminPassword = requireEnv('KEYCLOAK_ADMIN_PASSWORD')

    const baseUrl = `http://${keycloakHost}:${keycloakPort}`

    const kc = new KcAdminClient({ baseUrl, realmName: 'master' })

    try {
        await kc.auth({
            username: adminUser,
            password: adminPassword,
            grantType: 'password',
            clientId: 'admin-cli'
        })
    } catch (err) {
        console.error(
            `Failed to authenticate against Keycloak at ${baseUrl}.\n` +
                `Check that Keycloak is running and KEYCLOAK_ADMIN_USER / KEYCLOAK_ADMIN_PASSWORD are correct.\n` +
                `Error: ${(err as Error).message}`
        )
        process.exit(1)
    }

    // Switch to the target realm for user + role operations.
    kc.setConfig({ realmName: realm })

    await ensureAdminRoleExists(kc, realm)

    const password = generatePassword()

    let userId: string
    try {
        const created = await kc.users.create({
            realm,
            email,
            username: email,
            firstName: displayName,
            enabled: true,
            emailVerified: true,
            credentials: [
                {
                    type: 'password',
                    value: password,
                    temporary: false
                }
            ]
        })
        userId = created.id
    } catch (err) {
        const msg = (err as Error).message
        if (msg.includes('409') || msg.toLowerCase().includes('exists')) {
            console.error(
                `A user with email "${email}" already exists in realm "${realm}".\n` +
                    `Pick a different email, or delete the existing user via Keycloak admin console first.`
            )
            process.exit(1)
        }
        console.error(`Failed to create user: ${msg}`)
        process.exit(1)
    }

    // Look up the admin role representation, then assign it to the new user.
    const adminRole = await kc.roles.findOneByName({ realm, name: ADMIN_ROLE_NAME })
    if (!adminRole) {
        // Shouldn't happen — ensureAdminRoleExists ran above. Defensive.
        console.error(`Admin role missing after ensureAdminRoleExists. Bailing.`)
        process.exit(1)
    }

    await kc.users.addRealmRoleMappings({
        realm,
        id: userId,
        roles: [{ id: adminRole.id!, name: adminRole.name! }]
    })

    console.log(
        [
            '',
            '─────────────────────────────────────────────────────────────',
            '  Admin account created.',
            '─────────────────────────────────────────────────────────────',
            `  Realm:        ${realm}`,
            `  Email:        ${email}`,
            `  Display name: ${displayName}`,
            `  Password:     ${password}`,
            `  Keycloak ID:  ${userId}`,
            '─────────────────────────────────────────────────────────────',
            '  Save this password now. It is NOT stored anywhere and CANNOT',
            '  be recovered. To rotate it, reset via the Keycloak admin',
            '  console, or rerun this script with a different email.',
            '─────────────────────────────────────────────────────────────',
            ''
        ].join('\n')
    )
}

main().catch((err) => {
    console.error('Unexpected error:', err)
    process.exit(1)
})
