import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Prisma } from '../generated/prisma/client'
import { faker } from '@faker-js/faker'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ─────────────────────────────────────────────────────────────────────────────
// CampusGig seed script — generates a realistic dataset for the features that
// currently exist (F02 profile, F03 categories, F04 gigs, F06 wishlist).
//
// Markers:
//   • All seeded users have keycloakId starting with `seed-`. This is the only
//     way the script identifies its own rows for cleanup. Real users (created
//     via Keycloak sign-in) get UUID keycloakIds, so there's zero collision risk.
//   • Categories are upserted by name, so re-running won't duplicate them, and
//     real admin-created categories with different names are left alone.
//
// Re-run behaviour:
//   • By default: if seed users already exist, the script exits without doing
//     anything. Safe to run repeatedly.
//   • SEED_FORCE=1: deletes ALL seeded users (cascade wipes their gigs, saves,
//     skills) and re-seeds from scratch. Categories are upserted regardless.
//
// Image sources (all public, no auth):
//   • Avatars: DiceBear (https://api.dicebear.com)
//   • Gig images: Unsplash Source (vaguely on-topic per category keyword)
// ─────────────────────────────────────────────────────────────────────────────

faker.seed(20260528) // deterministic output across runs

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES: Array<{ name: string; icon: string; description: string; keyword: string }> = [
    {
        name: 'Programming',
        icon: 'CodeOutlined',
        description: 'Coding, debugging, and software help from fellow students.',
        keyword: 'coding'
    },
    {
        name: 'Design',
        icon: 'BgColorsOutlined',
        description: 'Logos, posters, slides, and visual assets for student projects.',
        keyword: 'design'
    },
    {
        name: 'Writing',
        icon: 'EditOutlined',
        description: 'Essays, reports, proofreading, and academic writing assistance.',
        keyword: 'writing'
    },
    {
        name: 'Tutoring',
        icon: 'BookOutlined',
        description: 'One-on-one tutoring for university courses.',
        keyword: 'study'
    },
    {
        name: 'Translation',
        icon: 'TranslationOutlined',
        description: 'Translate documents between Vietnamese, English, and more.',
        keyword: 'language'
    },
    {
        name: 'Video Editing',
        icon: 'VideoCameraOutlined',
        description: 'Cut, color, and caption your videos for school or socials.',
        keyword: 'video'
    },
    {
        name: 'Photography',
        icon: 'CameraOutlined',
        description: 'Event photos, portraits, and product shots on campus.',
        keyword: 'photography'
    },
    {
        name: 'Music',
        icon: 'CustomerServiceOutlined',
        description: 'Beats, mixing, vocals, and instrument lessons.',
        keyword: 'music'
    },
    {
        name: 'Marketing',
        icon: 'NotificationOutlined',
        description: 'Social media, copywriting, and campaign help for student orgs.',
        keyword: 'marketing'
    },
    {
        name: 'Data Entry',
        icon: 'InboxOutlined',
        description: 'Type, organize, and clean up your spreadsheets.',
        keyword: 'spreadsheet'
    },
    {
        name: 'Research',
        icon: 'ReadOutlined',
        description: 'Literature reviews, surveys, and data gathering.',
        keyword: 'research'
    },
    {
        name: 'Other',
        icon: 'AppstoreOutlined',
        description: 'Anything else: errands, event help, miscellaneous tasks.',
        keyword: 'campus'
    }
]

const VIETNAMESE_CITIES = [
    'Ho Chi Minh City',
    'Hanoi',
    'Da Nang',
    'Hai Phong',
    'Can Tho',
    'Bien Hoa',
    'Nha Trang',
    'Hue',
    'Vung Tau',
    'Buon Ma Thuot',
    'Da Lat'
]

const LANGUAGE_OPTIONS = [
    'Vietnamese (Native)',
    'Vietnamese (Native), English (Fluent)',
    'Vietnamese (Native), English (Conversational)',
    'Vietnamese (Native), English (Fluent), Japanese (Basic)',
    'Vietnamese (Native), English (Fluent), Korean (Basic)',
    'Vietnamese (Native), English (Fluent), French (Conversational)',
    'Vietnamese (Native), Chinese (Conversational)',
    'English (Native), Vietnamese (Conversational)'
]

const ROLE_LINES = [
    'Computer Science Senior',
    'CS Sophomore · Web Dev Enthusiast',
    'Graphic Design Junior',
    'Mathematics Tutor',
    'Engineering Senior · Math Peer Tutor',
    'Business Major · Marketing Lead',
    'Backend Engineer (Intern)',
    'Frontend Developer · Open Source Contributor',
    'UX Designer · Figma Specialist',
    'Photographer · Campus Events',
    'Music Producer · Mixing Engineer',
    'Translator EN ↔ VI',
    'Data Science Junior',
    'Mobile Developer · React Native',
    'Content Writer · Editor',
    'Video Editor · Motion Graphics',
    'Architecture Student',
    'Literature Major · Essay Coach',
    'Civil Engineering Senior',
    'Economics Major'
]

const SKILL_BANK = [
    'JavaScript',
    'TypeScript',
    'React',
    'Vue',
    'Node.js',
    'Python',
    'Java',
    'C++',
    'C#',
    'Go',
    'Rust',
    'SQL',
    'PostgreSQL',
    'MongoDB',
    'Docker',
    'AWS',
    'Figma',
    'Photoshop',
    'Illustrator',
    'After Effects',
    'Premiere Pro',
    'Lightroom',
    'Excel',
    'Google Sheets',
    'Notion',
    'Canva',
    'IELTS Prep',
    'TOEIC Prep',
    'Calculus',
    'Linear Algebra',
    'Statistics',
    'Discrete Math',
    'Academic Writing',
    'Copywriting',
    'SEO',
    'Social Media',
    'Public Speaking',
    'Translation EN-VI',
    'Translation VI-EN',
    'Voice Acting',
    'Music Theory',
    'Mixing',
    'Mastering',
    'Portrait Photography',
    'Event Photography',
    'Drone Footage',
    'Color Grading'
]

const TITLE_TEMPLATES: Record<string, string[]> = {
    Programming: [
        'I will build a {tech} website for you',
        'I will debug your {tech} code and fix bugs',
        'I will create a REST API in {tech}',
        'I will help with your {tech} assignment',
        'I will tutor you in {tech} programming',
        'I will write clean, tested {tech} code',
        'I will set up your {tech} project from scratch'
    ],
    Design: [
        'I will design a modern logo for your project',
        'I will create poster designs for your event',
        'I will design slick presentation slides',
        'I will create a Figma design system',
        'I will design a custom T-shirt for your club',
        'I will design social media graphics'
    ],
    Writing: [
        'I will proofread your essay or thesis',
        'I will write a research summary on any topic',
        'I will edit your academic paper',
        'I will write engaging blog posts',
        'I will improve your CV and cover letter',
        'I will write a personal statement for grad school'
    ],
    Tutoring: [
        'I will tutor Calculus 1 & 2 for your exam',
        'I will help you understand Linear Algebra',
        'I will tutor Physics for university students',
        'I will teach you Python from zero to confident',
        'I will help with Discrete Mathematics',
        'I will tutor Statistics & Probability'
    ],
    Translation: [
        'I will translate your document EN to VI accurately',
        'I will translate your essay VI to EN',
        'I will localize your app strings to Vietnamese',
        'I will translate subtitles for your video',
        'I will proofread your translated document'
    ],
    'Video Editing': [
        'I will edit your YouTube video professionally',
        'I will cut and color your event footage',
        'I will add captions and motion graphics to your video',
        'I will edit a highlight reel from your raw footage',
        'I will produce a short ad for your project'
    ],
    Photography: [
        'I will shoot portraits for your portfolio',
        'I will cover your campus event',
        'I will take product photos for your store',
        'I will provide professional headshots',
        'I will shoot graduation photos'
    ],
    Music: [
        'I will mix and master your song',
        'I will produce a custom beat for you',
        'I will record vocals for your track',
        'I will teach you guitar fundamentals',
        'I will compose background music for your video'
    ],
    Marketing: [
        'I will manage your Instagram for one week',
        'I will write copy for your campaign',
        'I will create a marketing strategy for your event',
        'I will design email newsletter templates',
        'I will run ads for your student business'
    ],
    'Data Entry': [
        'I will input your data into a spreadsheet',
        'I will organize your survey responses',
        'I will clean and format your CSV file',
        'I will transcribe handwritten notes to digital',
        'I will compile data from multiple sources'
    ],
    Research: [
        'I will write a literature review on your topic',
        'I will conduct a survey and analyze results',
        'I will gather sources for your research paper',
        'I will write a research proposal',
        'I will analyze qualitative interview data'
    ],
    Other: [
        'I will help you set up your dorm room',
        'I will run errands around campus for you',
        'I will help organize your event',
        'I will deliver food or supplies to your dorm',
        'I will pet-sit while you study abroad'
    ]
}

const PROG_TECHS = [
    'React',
    'Node.js',
    'Python',
    'Java',
    'C++',
    'TypeScript',
    'Vue',
    'Django',
    'Spring Boot',
    'Flutter'
]

// ── Helpers ────────────────────────────────────────────────────────────────

const pick = <T>(arr: readonly T[]): T => arr[faker.number.int({ min: 0, max: arr.length - 1 })]

const pickN = <T>(arr: readonly T[], n: number): T[] => {
    const copy = [...arr]
    const out: T[] = []
    for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = faker.number.int({ min: 0, max: copy.length - 1 })
        out.push(copy.splice(idx, 1)[0])
    }
    return out
}

const weightedPick = <T>(items: ReadonlyArray<{ value: T; weight: number }>): T => {
    const total = items.reduce((s, i) => s + i.weight, 0)
    let r = faker.number.float({ min: 0, max: total })
    for (const item of items) {
        r -= item.weight
        if (r <= 0) return item.value
    }
    return items[items.length - 1].value
}

const diceBearAvatar = (seed: string) =>
    `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=256`

const unsplashImage = (keyword: string, salt: string) =>
    // Picsum is more reliable than source.unsplash (which has been intermittently down).
    // We keep `keyword` so the alt/log line stays meaningful, and use a deterministic
    // seed so the same gig gets the same image across reruns.
    `https://picsum.photos/seed/${encodeURIComponent(keyword)}-${encodeURIComponent(salt)}/800/600`

// ── 1. Categories ──────────────────────────────────────────────────────────

async function seedCategories(): Promise<Map<string, string>> {
    console.log('  → upserting categories…')
    const idByName = new Map<string, string>()
    for (const c of CATEGORIES) {
        const row = await prisma.category.upsert({
            where: { name: c.name },
            create: { name: c.name, icon: c.icon, description: c.description },
            update: { icon: c.icon, description: c.description }
        })
        idByName.set(c.name, row.id)
    }
    console.log(`  ✓ ${CATEGORIES.length} categories ready`)
    return idByName
}

// ── 2. Users ───────────────────────────────────────────────────────────────

interface SeededUser {
    id: string
    username: string
    displayName: string
}

const VIETNAMESE_BANKS = ['Vietcombank', 'BIDV', 'Techcombank', 'ACB', 'Sacombank']

const WALLET_BALANCE_DIST = [
    { value: { min: 0, max: 0 }, weight: 0.3 }, // empty wallet
    { value: { min: 50_000, max: 500_000 }, weight: 0.5 },
    { value: { min: 500_000, max: 2_000_000 }, weight: 0.2 }
]

function randomAccountNumber(): string {
    let s = ''
    for (let i = 0; i < 10; i++) s += String(faker.number.int({ min: 0, max: 9 }))
    return s
}

async function seedUsers(): Promise<SeededUser[]> {
    console.log('  → creating 140 users…')
    const users: SeededUser[] = []
    for (let i = 0; i < 140; i++) {
        const first = faker.person.firstName()
        const last = faker.person.lastName()
        const displayName = `${first} ${last}`
        const username = `${first.toLowerCase()}${last.toLowerCase()}${i}`.replace(/[^a-z0-9]/g, '')
        const keycloakId = `seed-${String(i).padStart(4, '0')}`
        const endorsed = faker.number.float({ min: 0, max: 1 }) < 0.2

        const skillCount = faker.number.int({ min: 3, max: 6 })
        const skills = pickN(SKILL_BANK, skillCount)

        // Wallet (Feature 07): random balance + 30% chance of a bank account on file.
        const balanceRange = weightedPick(WALLET_BALANCE_DIST)
        const walletBalance = faker.number.int(balanceRange)
        const hasBank = faker.number.float({ min: 0, max: 1 }) < 0.3

        const created = await prisma.user.create({
            data: {
                keycloakId,
                username,
                email: faker.internet.email({ firstName: first, lastName: last }).toLowerCase(),
                displayName,
                avatarUrl: diceBearAvatar(keycloakId),
                bio: faker.lorem.sentences({ min: 2, max: 4 }),
                hasSetUsername: true,
                location: pick(VIETNAMESE_CITIES),
                roleLine: pick(ROLE_LINES),
                languages: pick(LANGUAGE_OPTIONS),
                endorsedAt: endorsed ? faker.date.recent({ days: 180 }) : null,
                endorsedBy: endorsed ? 'seed-admin' : null,
                isAdmin: false,
                walletBalance,
                bankName: hasBank ? pick(VIETNAMESE_BANKS) : null,
                bankAccountNumber: hasBank ? randomAccountNumber() : null,
                bankAccountHolder: hasBank ? displayName.toUpperCase() : null,
                skills: {
                    create: skills.map((name, position) => ({ name, position }))
                }
            }
        })
        users.push({ id: created.id, username: created.username!, displayName: created.displayName! })
    }
    console.log(`  ✓ 140 users created`)
    return users
}

// ── 3. Gigs ────────────────────────────────────────────────────────────────

// Weighted gig-count-per-user distribution. Targets ~400 gigs total across 140 users.
// Expected value: 0.30*0 + 0.35*1.5 + 0.25*4.5 + 0.10*9.5 = 0 + 0.525 + 1.125 + 0.95 = 2.6
//   → 140 * 2.6 ≈ 364. Close enough; we'll add a few extras to power sellers if short.
const GIG_COUNT_DIST = [
    { value: { min: 0, max: 0 }, weight: 0.3 }, // pure buyers
    { value: { min: 1, max: 2 }, weight: 0.35 },
    { value: { min: 3, max: 6 }, weight: 0.25 },
    { value: { min: 7, max: 12 }, weight: 0.1 } // power sellers
]

const GIG_STATUS_DIST = [
    { value: 'Active', weight: 0.9 },
    { value: 'Paused', weight: 0.05 },
    { value: 'Pending', weight: 0.03 },
    { value: 'Rejected', weight: 0.02 }
]

interface SeededGig {
    id: string
    sellerId: string
    categoryId: string
    status: string
}

function makeTitle(categoryName: string): string {
    const tmpl = pick(TITLE_TEMPLATES[categoryName] ?? TITLE_TEMPLATES.Other)
    return tmpl.replace('{tech}', pick(PROG_TECHS))
}

function makeDescription(categoryName: string, title: string): string {
    // 2-4 paragraphs; >=100 chars guaranteed by lorem.paragraphs.
    const intro = `${title}. ${faker.lorem.sentences({ min: 2, max: 4 })}`
    const body = faker.lorem.paragraphs({ min: 1, max: 2 }, '\n\n')
    return `${intro}\n\n${body}`
}

async function seedGigs(users: SeededUser[], categoryIds: Map<string, string>): Promise<SeededGig[]> {
    console.log('  → creating gigs…')
    const gigs: SeededGig[] = []

    for (const user of users) {
        const range = weightedPick(GIG_COUNT_DIST)
        const count = faker.number.int(range)

        for (let g = 0; g < count; g++) {
            const category = pick(CATEGORIES)
            const categoryId = categoryIds.get(category.name)!
            const status = weightedPick(GIG_STATUS_DIST)
            const title = makeTitle(category.name)
            const description = makeDescription(category.name, title)
            const priceVnd = faker.number.int({ min: 50_000, max: 2_000_000 })
            // round price to nearest 10k for realism
            const priceRounded = Math.round(priceVnd / 10_000) * 10_000
            const deliveryDays = faker.number.int({ min: 1, max: 14 })
            const imageCount = faker.number.int({ min: 3, max: 6 })
            const bulletCount = faker.number.int({ min: 3, max: 5 })
            const faqCount = faker.number.int({ min: 0, max: 3 })

            // Build image rows first (no gigId yet; we'll create them via nested write
            // and then update coverImageId in a follow-up update).
            const imageData = Array.from({ length: imageCount }, (_, i) => ({
                imageKey: unsplashImage(category.keyword, `${user.id}-${g}-${i}`),
                width: 800,
                height: 600,
                position: i,
                uploaderId: user.id
            }))

            const bulletData = Array.from({ length: bulletCount }, (_, i) => ({
                text: faker.lorem.sentence({ min: 4, max: 10 }).slice(0, 80),
                position: i
            }))

            const faqData = Array.from({ length: faqCount }, (_, i) => ({
                question: faker.lorem.sentence({ min: 4, max: 8 }).replace(/\.$/, '?'),
                answer: faker.lorem.sentences({ min: 1, max: 3 }),
                position: i
            }))

            const now = new Date()
            const submittedAt = status !== 'Pending' ? faker.date.recent({ days: 60 }) : now
            const approvedAt = status === 'Active' || status === 'Paused' ? faker.date.recent({ days: 30 }) : null
            const pausedAt = status === 'Paused' ? faker.date.recent({ days: 14 }) : null
            const rejectionCategory =
                status === 'Rejected'
                    ? pick(['Pricing', 'Description', 'Image quality', 'Policy violation', 'Other'])
                    : null
            const rejectionReason =
                status === 'Rejected' ? faker.lorem.sentence({ min: 5, max: 12 }).padEnd(25, ' ').slice(0, 200) : null

            const created = await prisma.gig.create({
                data: {
                    sellerId: user.id,
                    categoryId,
                    title,
                    description,
                    priceVnd: priceRounded,
                    deliveryDays,
                    status,
                    submittedAt,
                    approvedAt,
                    pausedAt,
                    rejectionCategory,
                    rejectionReason,
                    images: { create: imageData },
                    bullets: { create: bulletData },
                    faqs: { create: faqData }
                },
                include: { images: { where: { position: 0 }, select: { id: true } } }
            })

            // Backfill coverImageId on the gig
            if (created.images[0]?.id) {
                await prisma.gig.update({
                    where: { id: created.id },
                    data: { coverImageId: created.images[0].id }
                })
            }

            gigs.push({ id: created.id, sellerId: user.id, categoryId, status })
        }
    }
    console.log(`  ✓ ${gigs.length} gigs created`)
    return gigs
}

// ── 4. Saved Gigs (Wishlist) ───────────────────────────────────────────────

async function seedSavedGigs(users: SeededUser[], gigs: SeededGig[]): Promise<void> {
    console.log('  → creating saved gigs…')
    const activeGigs = gigs.filter((g) => g.status === 'Active')
    if (activeGigs.length === 0) {
        console.log('  ! No active gigs to save')
        return
    }

    let savedCount = 0
    for (const user of users) {
        const count = faker.number.int({ min: 10, max: 25 })
        // Filter out own gigs (a user can save their own, but it's noise)
        const candidates = activeGigs.filter((g) => g.sellerId !== user.id)
        const picks = pickN(candidates, Math.min(count, candidates.length))

        await prisma.savedGig.createMany({
            data: picks.map((g) => ({
                userId: user.id,
                gigId: g.id,
                savedAt: faker.date.recent({ days: 60 })
            })),
            skipDuplicates: true
        })
        savedCount += picks.length
    }
    console.log(`  ✓ ${savedCount} saves created`)
}

// ── 5. Wallet transactions + withdrawals (Feature 07 + 13) ─────────────────

const REJECT_REASONS = [
    'InvalidAccount',
    'SuspiciousActivity',
    'InsufficientDocumentation',
    'PolicyViolation',
    'Other'
] as const

const REJECT_REASON_LABELS: Record<(typeof REJECT_REASONS)[number], string> = {
    InvalidAccount: 'Invalid account',
    SuspiciousActivity: 'Suspicious activity',
    InsufficientDocumentation: 'Insufficient documentation',
    PolicyViolation: 'Policy violation',
    Other: 'Other'
}

const REJECT_NOTES = [
    'The bank account number provided does not match the account holder name. Please update your bank details and try again.',
    'Account information appears to be incorrect. Please verify and resubmit.',
    'Unable to process withdrawal at this time. Please contact support if you believe this is an error.'
]

async function seedWalletExtras(users: SeededUser[]): Promise<void> {
    console.log('  → seeding wallet transactions + withdrawals…')
    let txCount = 0
    let pendingCount = 0
    let processedCount = 0

    // Re-fetch users with bank-account info so we know who can withdraw.
    const fullUsers = await prisma.user.findMany({
        where: { id: { in: users.map((u) => u.id) } },
        select: {
            id: true,
            walletBalance: true,
            bankName: true,
            bankAccountNumber: true,
            bankAccountHolder: true
        }
    })

    for (const user of fullUsers) {
        // 5% chance: 1-3 historical Deposit transactions in the last 30 days.
        if (faker.number.float({ min: 0, max: 1 }) < 0.05) {
            const n = faker.number.int({ min: 1, max: 3 })
            for (let i = 0; i < n; i++) {
                const amount = faker.number.int({ min: 100_000, max: 500_000 })
                await prisma.transaction.create({
                    data: {
                        userId: user.id,
                        type: 'Deposit',
                        direction: 'Incoming',
                        status: 'Completed',
                        amountVnd: amount,
                        // Seed approximation — real balance-after history isn't tracked
                        // for historical rows; the user's current balance is a stand-in.
                        balanceAfterVnd: user.walletBalance,
                        description: 'Deposited to wallet',
                        createdAt: faker.date.recent({ days: 30 })
                    }
                })
                txCount++
            }
        }

        // Only users with a bank account can have withdrawals.
        if (!user.bankName || !user.bankAccountNumber || !user.bankAccountHolder) continue

        const last4 = user.bankAccountNumber.slice(-4)

        // 2% chance: a Pending withdrawal — visible in admin queue for demos.
        // Requires walletBalance >= minimum.
        if (faker.number.float({ min: 0, max: 1 }) < 0.02 && user.walletBalance >= 100_000) {
            const amount = faker.number.int({
                min: 100_000,
                max: Math.min(user.walletBalance, 800_000)
            })
            const requestedAt = faker.date.recent({ days: 5 })

            const request = await prisma.withdrawalRequest.create({
                data: {
                    userId: user.id,
                    amountVnd: amount,
                    bankNameSnapshot: user.bankName,
                    bankAccountNumberSnapshot: user.bankAccountNumber,
                    bankAccountHolderSnapshot: user.bankAccountHolder,
                    availableBalanceSnapshot: user.walletBalance,
                    status: 'Pending',
                    requestedAt
                }
            })
            await prisma.transaction.create({
                data: {
                    userId: user.id,
                    type: 'Withdrawal',
                    direction: 'Outgoing',
                    status: 'Pending',
                    amountVnd: amount,
                    balanceAfterVnd: user.walletBalance - amount,
                    withdrawalRequestId: request.id,
                    description: `To Bank Account · ····${last4} · awaiting admin approval`,
                    createdAt: requestedAt
                }
            })
            // Move from wallet to pending bucket.
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    walletBalance: { decrement: amount },
                    pendingWithdrawalBalance: { increment: amount }
                }
            })
            pendingCount++
        }

        // 5% chance: a historical Completed or Rejected withdrawal.
        if (faker.number.float({ min: 0, max: 1 }) < 0.05) {
            const completed = faker.number.float({ min: 0, max: 1 }) < 0.7
            const amount = faker.number.int({ min: 100_000, max: 800_000 })
            const requestedAt = faker.date.recent({ days: 25 })
            const processedAt = new Date(requestedAt.getTime() + faker.number.int({ min: 1, max: 48 }) * 3600_000)

            const request = await prisma.withdrawalRequest.create({
                data: {
                    userId: user.id,
                    amountVnd: amount,
                    bankNameSnapshot: user.bankName,
                    bankAccountNumberSnapshot: user.bankAccountNumber,
                    bankAccountHolderSnapshot: user.bankAccountHolder,
                    availableBalanceSnapshot: user.walletBalance + amount,
                    status: completed ? 'Completed' : 'Rejected',
                    requestedAt,
                    processedAt,
                    rejectionReason: completed
                        ? null
                        : (pick(REJECT_REASONS as unknown as string[]) as (typeof REJECT_REASONS)[number]),
                    rejectionNote: completed ? null : pick(REJECT_NOTES)
                }
            })

            const txDescription = completed
                ? `To Bank Account · ····${last4}`
                : `Withdrawal rejected — ${REJECT_REASON_LABELS[request.rejectionReason!]}\n${request.rejectionNote}`

            // Completed: snapshot − amount (money is gone).
            // Rejected: snapshot (money was restored to the user's wallet).
            const balanceAfterForSeed = completed
                ? request.availableBalanceSnapshot - amount
                : request.availableBalanceSnapshot

            await prisma.transaction.create({
                data: {
                    userId: user.id,
                    type: 'Withdrawal',
                    direction: 'Outgoing',
                    status: completed ? 'Completed' : 'Rejected',
                    amountVnd: amount,
                    balanceAfterVnd: balanceAfterForSeed,
                    withdrawalRequestId: request.id,
                    description: txDescription,
                    createdAt: processedAt
                }
            })
            // Note: for Completed, money already "left" — we don't touch user balance
            // here (the seed user's walletBalance was set independently above; this is
            // historical and doesn't affect current state).
            // For Rejected, same — historical, no balance touch.
            processedCount++
        }
    }

    console.log(
        `  ✓ ${txCount} historical deposits, ${pendingCount} pending withdrawals, ${processedCount} processed withdrawals`
    )
}

// ── 6. Messaging (Feature 08) ──────────────────────────────────────────────

const MESSAGE_BODIES = [
    'Hey! I saw your gig — can you help me?',
    'Sure! What kind of project are you working on?',
    "I'd need this done by next week. Possible?",
    'Yeah totally, that timeline works for me.',
    'Awesome, just placed the order!',
    'Got it, will start tonight.',
    'Quick question — what file format do you need?',
    'PDF is fine, but PNG works too if you have it.',
    'Sounds good, talk soon!',
    'Just sent over the first draft, let me know what you think.',
    'Looks great. Could you adjust the color palette?',
    "Sure, I'll send v2 in a bit.",
    'Thanks for the quick turnaround!',
    'Anytime, looking forward to working with you again.',
    'Hey, do you have availability next month?',
    'Yes! Pencil me in for the 15th.'
]

const SAMPLE_IMAGE_KEYS = [
    'picsum:https://picsum.photos/seed/chat-doc-1/600/400',
    'picsum:https://picsum.photos/seed/chat-doc-2/600/400',
    'picsum:https://picsum.photos/seed/chat-doc-3/600/400',
    'picsum:https://picsum.photos/seed/chat-doc-4/600/400'
]

async function seedMessages(users: SeededUser[]): Promise<void> {
    console.log('  → seeding message threads + messages…')

    let threadCount = 0
    let messageCount = 0
    let attachmentCount = 0
    let unreadCount = 0

    // Pick 3-7 peers per user (within seeded population). Normalize pair to
    // (userAId < userBId) so the unique index doesn't reject a duplicate.
    const createdPairs = new Set<string>()
    const now = Date.now()

    // First 3 seeded users serve as "demo accounts" — their threads have a
    // chance of carrying unread messages so the badge shows something
    // interesting after seed runs.
    const demoUserIds = new Set(users.slice(0, 3).map((u) => u.id))

    for (const user of users) {
        const peerCount = faker.number.int({ min: 3, max: 7 })
        const peers = faker.helpers.arrayElements(
            users.filter((u) => u.id !== user.id),
            peerCount
        )

        for (const peer of peers) {
            const [a, b] = user.id < peer.id ? [user, peer] : [peer, user]
            const key = `${a.id}:${b.id}`
            if (createdPairs.has(key)) continue
            createdPairs.add(key)

            const messageCountInThread = faker.number.int({ min: 5, max: 15 })
            const messages: Array<{
                body: string
                senderId: string
                createdAt: Date
                attachments: Array<{ key: string; name: string; size: number; mime: string }>
            }> = []

            // Walk backwards from "now" so the first message in the array is
            // the OLDEST. We'll insert in order and set lastMessageAt to the
            // latest.
            let cursor = now - faker.number.int({ min: 60_000, max: 14 * 24 * 3600_000 })
            for (let i = 0; i < messageCountInThread; i++) {
                const sender = faker.helpers.arrayElement([a, b])
                const body = faker.helpers.arrayElement(MESSAGE_BODIES)
                cursor += faker.number.int({ min: 30_000, max: 3 * 3600_000 })
                const hasAttachment = faker.number.float({ min: 0, max: 1 }) < 0.18
                const attachments = hasAttachment
                    ? [
                          {
                              key: faker.helpers.arrayElement(SAMPLE_IMAGE_KEYS),
                              name: `attachment-${faker.string.alphanumeric(6)}.jpg`,
                              size: faker.number.int({ min: 50_000, max: 800_000 }),
                              mime: 'image/jpeg'
                          }
                      ]
                    : []
                messages.push({
                    body,
                    senderId: sender.id,
                    createdAt: new Date(cursor),
                    attachments
                })
            }

            // Create the thread.
            const thread = await prisma.messageThread.create({
                data: {
                    userAId: a.id,
                    userBId: b.id,
                    lastMessageAt: messages[messages.length - 1].createdAt
                }
            })
            threadCount++

            // Insert messages + attachments in chronological order.
            for (const m of messages) {
                const created = await prisma.message.create({
                    data: {
                        threadId: thread.id,
                        senderId: m.senderId,
                        body: m.body,
                        createdAt: m.createdAt
                    }
                })
                messageCount++
                for (const att of m.attachments) {
                    await prisma.messageAttachment.create({
                        data: {
                            messageId: created.id,
                            key: att.key,
                            name: att.name,
                            size: att.size,
                            mime: att.mime,
                            createdAt: m.createdAt
                        }
                    })
                    attachmentCount++
                }
            }

            // Read cursors: by default both sides have seen everything (so
            // unread counts stay 0). For threads touching a demo account,
            // leave a chance of unread messages from the OTHER party.
            const demoSide = demoUserIds.has(a.id) ? a.id : demoUserIds.has(b.id) ? b.id : null
            const isUnreadThread = demoSide && faker.number.float({ min: 0, max: 1 }) < 0.4

            const latestMessage = messages[messages.length - 1]
            const cutoffForDemo = isUnreadThread
                ? messages[Math.max(0, messages.length - 3)].createdAt
                : latestMessage.createdAt

            for (const userId of [a.id, b.id]) {
                const isThisDemo = isUnreadThread && userId === demoSide
                const myCutoff = isThisDemo ? cutoffForDemo : latestMessage.createdAt
                await prisma.messageReadCursor.create({
                    data: {
                        threadId: thread.id,
                        userId,
                        lastReadAt: myCutoff
                    }
                })
                if (isThisDemo) {
                    const unreadMsgs = messages.filter((m) => m.senderId !== userId && m.createdAt > myCutoff)
                    unreadCount += unreadMsgs.length
                }
            }
        }
    }

    console.log(
        `  ✓ ${threadCount} threads, ${messageCount} messages, ${attachmentCount} attachments (${unreadCount} unread for demo accounts)`
    )
}

// ── Orders + transitions (Phase 1 + Phase 2 mix) ──────────────────────────
//
// Produces ~5 orders per demo seller buyer pair covering every reachable
// status so /orders, /dashboard, and the workspace all have content on a
// fresh seed run. Wallet movements are written directly here (rather than
// going through the orders module) because the seed script runs outside
// the NestJS DI container.

const PLATFORM_USER_ID = '00000000-0000-0000-0000-000000000001'
const SEED_PLATFORM_FEE_PCT = 20

// How many days after `placedAt` simulated transitions happen. Kept tight
// so the timestamps are believable for a fresh seed (most orders happened
// in the last 2 weeks).
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// F11 — review text banks + weighted rating. Reviews are seeded on a subset of
// Completed orders so Browse/Detail/Profile/Manage show real aggregates.
const REVIEW_BODIES_POSITIVE = [
    'Absolute lifesaver. Clear explanations and delivered ahead of schedule. Would book again in a heartbeat.',
    'Super patient and really knew the material. Helped me finally understand the tricky parts before my exam.',
    'Great communication throughout and the final result exceeded what I expected. Highly recommend.',
    'Fast, friendly, and professional. Everything was exactly what I asked for and the quality was top-notch.',
    'Walked me through every step and answered all my questions. Felt confident by the end. Thank you!',
    'Quality work and a quick turnaround. Easy to work with and very responsive to feedback.',
    'Went above and beyond — caught a couple of issues I hadn’t even noticed. Really appreciated the care.'
]
const REVIEW_BODIES_MIXED = [
    'Decent work overall. Took a little longer than I hoped but the end result was solid.',
    'Got the job done. Communication could have been a bit clearer but I’m satisfied with the outcome.',
    'The delivery was okay — needed one round of revisions to get it right, but they were responsive about it.',
    'Fair value for the price. Not perfect, but covered what I needed for the assignment.'
]
const REVIEW_REPLIES = [
    'Thank you so much for the kind words — it was a pleasure working with you!',
    'Really appreciate the feedback! Glad I could help. Reach out anytime.',
    'Thanks for the review! Wishing you the best on your exam.',
    'Thank you! Let me know if you need anything else down the line.'
]

// Weighted half-star rating: skewed high, occasional 3, rare 1-2.
function pickRatingHalfStars(): number {
    const r = faker.number.float({ min: 0, max: 1 })
    if (r < 0.5) return 10 // 5.0
    if (r < 0.72) return 9 // 4.5
    if (r < 0.87) return 8 // 4.0
    if (r < 0.93) return 7 // 3.5
    if (r < 0.97) return 6 // 3.0
    return faker.helpers.arrayElement([4, 3, 2]) // 2.0 / 1.5 / 1.0
}

interface OrderSpec {
    // Friendly label used in console logs only.
    kind:
        | 'pending-review'
        | 'in-progress'
        | 'late'
        | 'delivered'
        | 'delivered-pending-extension'
        | 'in-progress-pending-cancellation'
        | 'awaiting-finalization'
        | 'completed'
        | 'cancelled'
}

async function seedOrders(users: SeededUser[]): Promise<void> {
    console.log('  → creating Phase 1+2 demo orders…')

    // First 3 demo users get the rich mix. Need at least 2 to have a
    // counterparty; we'll always pair a demo BUYER with a seeded SELLER
    // who has at least one Active gig.
    const demoBuyers = users.slice(0, 3)
    if (demoBuyers.length === 0) return

    // Fetch a pool of Active gigs whose seller is in the seeded set and
    // is NOT one of the demo buyers themselves.
    const allActiveGigs = await prisma.gig.findMany({
        where: { status: 'Active' },
        select: { id: true, sellerId: true, priceVnd: true, deliveryDays: true, title: true },
        take: 200
    })

    // Per-buyer fan-out. Skips silently if there aren't enough gigs to pick.
    let orderCount = 0
    let extCount = 0
    let cancelCount = 0

    for (const buyer of demoBuyers) {
        const eligibleGigs = allActiveGigs.filter((g: { sellerId: string }) => g.sellerId !== buyer.id)
        if (eligibleGigs.length < 3) continue

        // Different gigs per kind so the workspace lists don't show the
        // same gig title repeated for the demo buyer.
        const specs: OrderSpec['kind'][] = [
            'pending-review',
            'in-progress',
            'late',
            'delivered',
            'delivered-pending-extension',
            'in-progress-pending-cancellation',
            'awaiting-finalization',
            'completed',
            'cancelled'
        ]

        for (const kind of specs) {
            const gig = pick(eligibleGigs)
            const result = await seedOneOrder(buyer, gig, kind)
            orderCount += 1
            extCount += result.extensions
            cancelCount += result.cancellations
        }
    }

    console.log(`  ✓ ${orderCount} orders, ${extCount} pending extensions, ${cancelCount} pending cancellations`)
}

// Gig-detail views for the Performance card. Active gigs only; counts weighted
// (most modest, a few outliers) and timestamps lean recent so short periods
// still show data.
const VIEW_COUNT_DIST: ReadonlyArray<{ value: { min: number; max: number }; weight: number }> = [
    { value: { min: 0, max: 0 }, weight: 8 }, // brand-new, no views yet
    { value: { min: 1, max: 15 }, weight: 22 },
    { value: { min: 16, max: 60 }, weight: 38 },
    { value: { min: 61, max: 160 }, weight: 24 },
    { value: { min: 161, max: 400 }, weight: 8 } // breakout gig
]

const VIEW_WINDOW_DAYS = 120

async function seedGigViews(gigs: SeededGig[]): Promise<void> {
    console.log('  → creating gig views…')
    const activeGigs = gigs.filter((g) => g.status === 'Active')
    const now = Date.now()
    let total = 0

    // Order counts per seeded gig so a gig with orders never shows 0 views /
    // "—" conversion — we floor its views at a believable multiple of orders.
    const orderCounts = new Map<string, number>()
    const grouped = await prisma.order.groupBy({
        by: ['gigId'],
        where: { gigId: { in: activeGigs.map((g) => g.id) } },
        _count: { _all: true }
    })
    for (const row of grouped) orderCounts.set(row.gigId, row._count._all)

    for (const gig of activeGigs) {
        const orders = orderCounts.get(gig.id) ?? 0
        let count = faker.number.int(weightedPick(VIEW_COUNT_DIST))
        // ~8-25 views per order keeps conversion in a realistic single-digit-%
        // to low-teens range for gigs that actually sold.
        if (orders > 0) count = Math.max(count, orders * faker.number.int({ min: 8, max: 25 }))
        if (count === 0) continue

        const rows = Array.from({ length: count }, () => {
            // min-of-two uniforms biases each view's timestamp toward recent days.
            const dayOffset = Math.min(
                faker.number.int({ min: 0, max: VIEW_WINDOW_DAYS - 1 }),
                faker.number.int({ min: 0, max: VIEW_WINDOW_DAYS - 1 })
            )
            const intraDayMs = faker.number.int({ min: 0, max: DAY_MS - 1 })
            return { gigId: gig.id, createdAt: new Date(now - dayOffset * DAY_MS - intraDayMs) }
        })

        await prisma.gigView.createMany({ data: rows })
        total += count
    }

    console.log(`  ✓ ${total} gig views across ${activeGigs.length} active gigs`)
}

// F12 — disputes across statuses on the demo buyers' disputable orders. Money
// isn't moved here (the resolved payout is computed from price + verdict on
// read), so wallet balances stay as seeded — fine for the demo.
const DISPUTE_PLATFORM_USER_ID = '00000000-0000-0000-0000-000000000001'
const HOUR = 60 * 60 * 1000

async function seedDisputes(users: SeededUser[]): Promise<void> {
    console.log('  → creating disputes…')
    const demoBuyerIds = users.slice(0, 3).map((u) => u.id)
    if (demoBuyerIds.length === 0) return

    const candidates = await prisma.order.findMany({
        where: {
            buyerId: { in: demoBuyerIds },
            status: { in: ['InProgress', 'Late', 'Delivered', 'AwaitingFinalization'] }
        },
        select: { id: true, buyerId: true, sellerId: true, number: true },
        take: 12
    })

    const buyerStatement =
        'The delivered work does not match what we agreed on in chat. Several key requirements are missing and I have asked for fixes multiple times with no result.'
    const sellerStatement =
        'The buyer keeps demanding extra work far beyond the agreed scope and is threatening a bad review unless I comply. I delivered exactly what was ordered.'
    const responderStatement =
        'Here is my side: I delivered everything that was agreed, and the requested changes were never part of the original order.'

    const scenarios = [
        { kind: 'awaiting', role: 'Buyer', reason: 'WorkNotAsDescribed', deadlineH: 36 },
        { kind: 'awaiting', role: 'Seller', reason: 'BuyerOutOfScope', deadlineH: 11 },
        { kind: 'ready', role: 'Buyer', reason: 'SellerNeverDelivered' },
        { kind: 'resolved', role: 'Buyer', reason: 'WorkNotAsDescribed', verdict: 'RefundBuyer' },
        { kind: 'resolved', role: 'Seller', reason: 'BuyerReviewThreat', verdict: 'CompleteForSeller' },
        { kind: 'resolved', role: 'Buyer', reason: 'WorkNotAsDescribed', verdict: 'SplitFunds', buyerRefundPercent: 40 }
    ] as const

    const now = Date.now()
    let made = 0

    for (let i = 0; i < scenarios.length && i < candidates.length; i++) {
        const order = candidates[i]
        const s = scenarios[i]
        const filedByUserId = s.role === 'Buyer' ? order.buyerId : order.sellerId
        const filerStatement = s.role === 'Buyer' ? buyerStatement : sellerStatement
        const filedEvent = {
            orderId: order.id,
            type: 'DisputeFiled' as const,
            actorUserId: filedByUserId,
            payload: { number: order.number, role: s.role, reasonCode: s.reason }
        }

        if (s.kind === 'awaiting') {
            await prisma.$transaction([
                prisma.dispute.create({
                    data: {
                        orderId: order.id,
                        filedByUserId,
                        filedByRole: s.role,
                        reasonCode: s.reason,
                        filerStatement,
                        status: 'AwaitingResponse',
                        responseDeadline: new Date(now + s.deadlineH * HOUR),
                        filedAt: new Date(now - (48 - s.deadlineH) * HOUR)
                    }
                }),
                prisma.order.update({ where: { id: order.id }, data: { status: 'Frozen' } }),
                prisma.orderEvent.create({ data: filedEvent })
            ])
        } else if (s.kind === 'ready') {
            await prisma.$transaction([
                prisma.dispute.create({
                    data: {
                        orderId: order.id,
                        filedByUserId,
                        filedByRole: s.role,
                        reasonCode: s.reason,
                        filerStatement,
                        respondedAt: new Date(now - 2 * HOUR),
                        responderStatement,
                        status: 'ReadyForReview',
                        responseDeadline: new Date(now + 30 * HOUR),
                        filedAt: new Date(now - 18 * HOUR)
                    }
                }),
                prisma.order.update({ where: { id: order.id }, data: { status: 'Frozen' } }),
                prisma.orderEvent.create({ data: filedEvent })
            ])
        } else {
            const terminal = s.verdict === 'RefundBuyer' ? 'Cancelled' : 'Completed'
            await prisma.$transaction([
                prisma.dispute.create({
                    data: {
                        orderId: order.id,
                        filedByUserId,
                        filedByRole: s.role,
                        reasonCode: s.reason,
                        filerStatement,
                        respondedAt: new Date(now - 50 * HOUR),
                        responderStatement,
                        status: 'Resolved',
                        responseDeadline: new Date(now - 24 * HOUR),
                        verdict: s.verdict,
                        buyerRefundPercent: s.verdict === 'SplitFunds' ? s.buyerRefundPercent : null,
                        resolvedByUserId: DISPUTE_PLATFORM_USER_ID,
                        resolvedAt: new Date(now - 12 * HOUR),
                        filedAt: new Date(now - 72 * HOUR)
                    }
                }),
                prisma.order.update({
                    where: { id: order.id },
                    data:
                        terminal === 'Cancelled'
                            ? {
                                  status: 'Cancelled',
                                  cancelledAt: new Date(now - 12 * HOUR),
                                  cancelledByUserId: DISPUTE_PLATFORM_USER_ID,
                                  cancellationReason: 'Dispute resolved — full refund'
                              }
                            : { status: 'Completed', completedAt: new Date(now - 12 * HOUR) }
                }),
                prisma.orderEvent.create({ data: filedEvent }),
                prisma.orderEvent.create({
                    data: {
                        orderId: order.id,
                        type: 'DisputeResolved' as const,
                        actorUserId: DISPUTE_PLATFORM_USER_ID,
                        payload: { number: order.number, verdict: s.verdict }
                    }
                })
            ])
        }
        made++
    }

    console.log(`  ✓ ${made} disputes seeded`)
}

async function seedOneOrder(
    buyer: SeededUser,
    gig: {
        id: string
        sellerId: string
        priceVnd: number
        deliveryDays: number
        title: string
    },
    kind: OrderSpec['kind']
): Promise<{ extensions: number; cancellations: number }> {
    // Reference timestamps anchored to "now" minus an age that suits each
    // kind. Most lifecycles span the last ~2 weeks.
    const now = Date.now()
    let extensions = 0
    let cancellations = 0

    const params = (() => {
        switch (kind) {
            case 'pending-review':
                return {
                    placedAt: new Date(now - 6 * HOUR_MS),
                    status: 'PendingReview' as const,
                    acceptDeadline: new Date(now + 18 * HOUR_MS),
                    acceptedAt: null as Date | null,
                    deliveryDeadline: null as Date | null,
                    deliveredAt: null as Date | null,
                    reviewDeadline: null as Date | null,
                    completedAt: null as Date | null,
                    cancelledAt: null as Date | null,
                    autoCompletedAt: null as Date | null,
                    disputeDeadline: null as Date | null
                }
            case 'in-progress':
                return {
                    placedAt: new Date(now - 3 * DAY_MS),
                    status: 'InProgress' as const,
                    acceptDeadline: null,
                    acceptedAt: new Date(now - 2 * DAY_MS),
                    deliveryDeadline: new Date(now + gig.deliveryDays * DAY_MS - 2 * DAY_MS),
                    deliveredAt: null,
                    reviewDeadline: null,
                    completedAt: null,
                    cancelledAt: null,
                    autoCompletedAt: null,
                    disputeDeadline: null
                }
            case 'late':
                return {
                    placedAt: new Date(now - 9 * DAY_MS),
                    status: 'Late' as const,
                    acceptDeadline: null,
                    acceptedAt: new Date(now - 8 * DAY_MS),
                    // Deadline that's already passed — order auto-flipped to Late.
                    deliveryDeadline: new Date(now - 12 * HOUR_MS),
                    deliveredAt: null,
                    reviewDeadline: null,
                    completedAt: null,
                    cancelledAt: null,
                    autoCompletedAt: null,
                    disputeDeadline: null
                }
            case 'delivered':
                return {
                    placedAt: new Date(now - 4 * DAY_MS),
                    status: 'Delivered' as const,
                    acceptDeadline: null,
                    acceptedAt: new Date(now - 3 * DAY_MS),
                    deliveryDeadline: new Date(now - 6 * HOUR_MS),
                    deliveredAt: new Date(now - 1 * DAY_MS),
                    reviewDeadline: new Date(now + 48 * HOUR_MS),
                    completedAt: null,
                    cancelledAt: null,
                    autoCompletedAt: null,
                    disputeDeadline: null
                }
            case 'delivered-pending-extension':
                return {
                    placedAt: new Date(now - 4 * DAY_MS),
                    status: 'Delivered' as const,
                    acceptDeadline: null,
                    acceptedAt: new Date(now - 3 * DAY_MS),
                    deliveryDeadline: new Date(now - 6 * HOUR_MS),
                    deliveredAt: new Date(now - 1 * DAY_MS),
                    reviewDeadline: new Date(now + 36 * HOUR_MS),
                    completedAt: null,
                    cancelledAt: null,
                    autoCompletedAt: null,
                    disputeDeadline: null
                }
            case 'in-progress-pending-cancellation':
                return {
                    placedAt: new Date(now - 2 * DAY_MS),
                    status: 'InProgress' as const,
                    acceptDeadline: null,
                    acceptedAt: new Date(now - 1.5 * DAY_MS),
                    deliveryDeadline: new Date(now + 4 * DAY_MS),
                    deliveredAt: null,
                    reviewDeadline: null,
                    completedAt: null,
                    cancelledAt: null,
                    autoCompletedAt: null,
                    disputeDeadline: null
                }
            case 'awaiting-finalization':
                return {
                    placedAt: new Date(now - 8 * DAY_MS),
                    status: 'AwaitingFinalization' as const,
                    acceptDeadline: null,
                    acceptedAt: new Date(now - 7 * DAY_MS),
                    deliveryDeadline: new Date(now - 4 * DAY_MS),
                    deliveredAt: new Date(now - 5 * DAY_MS),
                    // Review window already elapsed — order auto-completed.
                    reviewDeadline: new Date(now - 2 * DAY_MS),
                    completedAt: null,
                    cancelledAt: null,
                    autoCompletedAt: new Date(now - 2 * DAY_MS),
                    disputeDeadline: new Date(now + 5 * DAY_MS)
                }
            case 'completed':
                return {
                    placedAt: new Date(now - 30 * DAY_MS),
                    status: 'Completed' as const,
                    acceptDeadline: null,
                    acceptedAt: new Date(now - 29 * DAY_MS),
                    deliveryDeadline: new Date(now - 25 * DAY_MS),
                    deliveredAt: new Date(now - 26 * DAY_MS),
                    reviewDeadline: new Date(now - 23 * DAY_MS),
                    completedAt: new Date(now - 25 * DAY_MS),
                    cancelledAt: null,
                    autoCompletedAt: null,
                    disputeDeadline: null
                }
            case 'cancelled':
                return {
                    placedAt: new Date(now - 14 * DAY_MS),
                    status: 'Cancelled' as const,
                    acceptDeadline: null,
                    acceptedAt: null,
                    deliveryDeadline: null,
                    deliveredAt: null,
                    reviewDeadline: null,
                    completedAt: null,
                    cancelledAt: new Date(now - 13 * DAY_MS),
                    autoCompletedAt: null,
                    disputeDeadline: null
                }
        }
    })()

    // Insert the order with snapshotted gig fields.
    const order = await prisma.order.create({
        data: {
            buyerId: buyer.id,
            sellerId: gig.sellerId,
            gigId: gig.id,
            gigTitleSnapshot: gig.title,
            gigPriceVndSnapshot: gig.priceVnd,
            gigDeliveryDays: gig.deliveryDays,
            gigCoverKey: null,
            status: params.status,
            placedAt: params.placedAt,
            acceptedAt: params.acceptedAt,
            deliveredAt: params.deliveredAt,
            completedAt: params.completedAt,
            cancelledAt: params.cancelledAt,
            autoCompletedAt: params.autoCompletedAt,
            acceptDeadline: params.acceptDeadline,
            deliveryDeadline: params.deliveryDeadline,
            reviewDeadline: params.reviewDeadline,
            disputeDeadline: params.disputeDeadline,
            cancelledByUserId: params.status === 'Cancelled' ? gig.sellerId : null,
            cancellationReason: params.status === 'Cancelled' ? "Schedule conflict — can't deliver in time" : null
        }
    })

    // Wallet movements: only for the active money paths.
    //   • Placed/InProgress/Late/Delivered/AwaitingFinalization → buyer
    //     wallet decremented + escrow increased + Payment Transaction.
    //   • Completed → buyer's escrow released to seller (80%) + platform (20%)
    //     with Earning + PlatformFee transactions. Buyer wallet stays
    //     decremented (already paid at place-order time).
    //   • Cancelled → buyer wallet refunded + Refund Transaction.
    const inEscrow = ['PendingReview', 'InProgress', 'Late', 'Delivered', 'AwaitingFinalization']
    if (inEscrow.includes(params.status)) {
        await prisma.user.update({
            where: { id: buyer.id },
            data: {
                walletBalance: { decrement: gig.priceVnd },
                escrowBalance: { increment: gig.priceVnd }
            }
        })
        const buyerAfter = await prisma.user.findUnique({
            where: { id: buyer.id },
            select: { walletBalance: true }
        })
        await prisma.transaction.create({
            data: {
                userId: buyer.id,
                type: 'Payment',
                direction: 'Outgoing',
                status: 'Completed',
                amountVnd: gig.priceVnd,
                balanceAfterVnd: buyerAfter?.walletBalance ?? null,
                orderId: order.id,
                description: `Held in escrow for order ${order.id}`,
                createdAt: params.placedAt
            }
        })
    } else if (params.status === 'Completed') {
        // Settle: buyer paid → seller + platform earn.
        await prisma.user.update({
            where: { id: buyer.id },
            data: { walletBalance: { decrement: gig.priceVnd } }
        })
        const platformShare = Math.floor((gig.priceVnd * SEED_PLATFORM_FEE_PCT) / 100)
        const sellerShare = gig.priceVnd - platformShare
        await prisma.user.update({
            where: { id: gig.sellerId },
            data: { walletBalance: { increment: sellerShare } }
        })
        await prisma.user.update({
            where: { id: PLATFORM_USER_ID },
            data: { walletBalance: { increment: platformShare } }
        })
        const buyerAfter = await prisma.user.findUnique({
            where: { id: buyer.id },
            select: { walletBalance: true }
        })
        const sellerAfter = await prisma.user.findUnique({
            where: { id: gig.sellerId },
            select: { walletBalance: true }
        })
        const platformAfter = await prisma.user.findUnique({
            where: { id: PLATFORM_USER_ID },
            select: { walletBalance: true }
        })
        await prisma.transaction.create({
            data: {
                userId: buyer.id,
                type: 'Payment',
                direction: 'Outgoing',
                status: 'Completed',
                amountVnd: gig.priceVnd,
                balanceAfterVnd: buyerAfter?.walletBalance ?? null,
                orderId: order.id,
                description: `Held in escrow for order ${order.id}`,
                createdAt: params.placedAt
            }
        })
        await prisma.transaction.create({
            data: {
                userId: gig.sellerId,
                type: 'Earning',
                direction: 'Incoming',
                status: 'Completed',
                amountVnd: sellerShare,
                balanceAfterVnd: sellerAfter?.walletBalance ?? null,
                orderId: order.id,
                description: `Earned from order ${order.id}`,
                createdAt: params.completedAt!
            }
        })
        await prisma.transaction.create({
            data: {
                userId: PLATFORM_USER_ID,
                type: 'Earning',
                direction: 'Incoming',
                status: 'Completed',
                amountVnd: platformShare,
                balanceAfterVnd: platformAfter?.walletBalance ?? null,
                orderId: order.id,
                description: `Platform fee from order ${order.id}`,
                createdAt: params.completedAt!
            }
        })
    } else if (params.status === 'Cancelled') {
        // Buyer never lost money — payment + refund net to zero. We still
        // record both transactions so the buyer's wallet history shows the
        // full sequence.
        const buyerAfter = await prisma.user.findUnique({
            where: { id: buyer.id },
            select: { walletBalance: true }
        })
        await prisma.transaction.create({
            data: {
                userId: buyer.id,
                type: 'Payment',
                direction: 'Outgoing',
                status: 'Completed',
                amountVnd: gig.priceVnd,
                balanceAfterVnd: buyerAfter?.walletBalance != null ? buyerAfter.walletBalance - gig.priceVnd : null,
                orderId: order.id,
                description: `Held in escrow for order ${order.id}`,
                createdAt: params.placedAt
            }
        })
        await prisma.transaction.create({
            data: {
                userId: buyer.id,
                type: 'Refund',
                direction: 'Incoming',
                status: 'Completed',
                amountVnd: gig.priceVnd,
                balanceAfterVnd: buyerAfter?.walletBalance ?? null,
                orderId: order.id,
                description: `Refunded from order ${order.id}`,
                createdAt: params.cancelledAt!
            }
        })
    }

    // Pending extension (seller-initiated; 24h decide window). For the
    // delivered-pending-extension kind we plant one Pending row so the
    // buyer's workspace shows the decision card live.
    if (kind === 'delivered-pending-extension') {
        const requestedAt = new Date(now - 2 * HOUR_MS)
        await prisma.extension.create({
            data: {
                orderId: order.id,
                requestedById: gig.sellerId,
                hoursRequested: 24,
                reason: 'Need an extra day to polish the deliverables.',
                status: 'Pending',
                requestedAt,
                expiresAt: new Date(requestedAt.getTime() + 22 * HOUR_MS)
            }
        })
        extensions += 1
    }

    // Pending cancellation (buyer-initiated; seller deciding). Set up for
    // the in-progress-pending-cancellation kind.
    if (kind === 'in-progress-pending-cancellation') {
        const requestedAt = new Date(now - 4 * HOUR_MS)
        await prisma.cancellation.create({
            data: {
                orderId: order.id,
                requestedById: buyer.id,
                initiator: 'Buyer',
                reasonCode: 'BuyerSituationChanged',
                otherText: null,
                status: 'Pending',
                requestedAt,
                expiresAt: new Date(requestedAt.getTime() + 20 * HOUR_MS)
            }
        })
        cancellations += 1
    }

    // F11 — seed a review on ~75% of Completed orders. Skewed-high rating,
    // ~40% get a seller reply. Aggregates incremented to match the runtime path.
    if (order.status === 'Completed' && faker.number.float({ min: 0, max: 1 }) < 0.75) {
        const ratingHalfStars = pickRatingHalfStars()
        const body = pick(ratingHalfStars >= 8 ? REVIEW_BODIES_POSITIVE : REVIEW_BODIES_MIXED)
        const createdAt = new Date((order.completedAt ?? order.placedAt).getTime() + 6 * HOUR_MS)
        const replied = faker.number.float({ min: 0, max: 1 }) < 0.4
        await prisma.review.create({
            data: {
                orderId: order.id,
                gigId: gig.id,
                sellerId: gig.sellerId,
                buyerId: buyer.id,
                ratingHalfStars,
                body,
                replyBody: replied ? pick(REVIEW_REPLIES) : null,
                repliedAt: replied ? new Date(createdAt.getTime() + 12 * HOUR_MS) : null,
                createdAt
            }
        })
        await prisma.gig.update({
            where: { id: gig.id },
            data: { reviewCount: { increment: 1 }, ratingSumHalfStars: { increment: ratingHalfStars } }
        })
        await prisma.user.update({
            where: { id: gig.sellerId },
            data: { reviewCount: { increment: 1 }, ratingSumHalfStars: { increment: ratingHalfStars } }
        })
    }

    return { extensions, cancellations }
}

// ── F14: Admin user + activity backfill + report exports ────────────────────

const SEED_ADMIN_KEYCLOAK_ID = 'seed-admin'

// A real admin User so AdminActivityLog/ReportExport FKs resolve and the
// Activity Log "Admin" filter has an entry. keycloakId starts with `seed-`, so
// cleanupSeedData removes it like any other seed row.
async function seedAdminUser(): Promise<string> {
    console.log('  → creating seed admin user…')
    const admin = await prisma.user.upsert({
        where: { keycloakId: SEED_ADMIN_KEYCLOAK_ID },
        create: {
            keycloakId: SEED_ADMIN_KEYCLOAK_ID,
            username: '__seed_admin__',
            email: 'admin@campusgig.vn',
            displayName: 'CampusGig Admin',
            isAdmin: true,
            hasSetUsername: true
        },
        update: { isAdmin: true, email: 'admin@campusgig.vn' }
    })
    console.log('  ✓ seed admin ready')
    return admin.id
}

// Backfills AdminActivityLog from already-seeded rows (resolved disputes,
// processed/rejected withdrawals, approved/rejected gigs, categories,
// endorsements). The seed writes those rows directly (bypassing the handlers
// that normally log), so without this the Activity Log + dashboard feed would
// be empty on demo data.
async function seedAdminActivity(adminId: string): Promise<void> {
    console.log('  → backfilling admin activity log…')
    const SEED = { keycloakId: { startsWith: 'seed-' } }
    const fmtVnd = (n: number) => `${n.toLocaleString('vi-VN')}₫`
    const orderCode = (n: number) => `CG-${String(n).padStart(4, '0')}`
    const VERDICT_LABEL: Record<string, string> = {
        RefundBuyer: 'Refund buyer',
        CompleteForSeller: 'Complete for seller',
        SplitFunds: 'Split funds'
    }
    const nameOf = (u: { displayName: string | null; username: string | null }) =>
        u.displayName ?? u.username ?? 'a user'

    // Gig has no `seller` relation (only sellerId), so resolve seller names via a
    // map of the seed users.
    const seedUsers = await prisma.user.findMany({
        where: SEED,
        select: { id: true, displayName: true, username: true }
    })
    const seedUserIds = seedUsers.map((u) => u.id)
    const nameById = new Map(seedUsers.map((u) => [u.id, nameOf(u)]))

    const rows: Prisma.AdminActivityLogCreateManyInput[] = []

    const disputes = await prisma.dispute.findMany({
        where: { status: 'Resolved', order: { seller: SEED } },
        select: {
            orderId: true,
            verdict: true,
            buyerRefundPercent: true,
            resolvedAt: true,
            order: { select: { number: true } }
        },
        take: 30
    })
    for (const d of disputes) {
        rows.push({
            adminUserId: adminId,
            actionType: 'dispute_resolved',
            targetType: 'order',
            targetId: d.orderId,
            summary: `${orderCode(d.order.number)} · ${VERDICT_LABEL[d.verdict ?? ''] ?? d.verdict ?? ''}`,
            metadata: { verdict: d.verdict, buyerRefundPercent: d.buyerRefundPercent },
            createdAt: d.resolvedAt ?? new Date()
        })
    }

    const withdrawals = await prisma.withdrawalRequest.findMany({
        where: { status: { in: ['Completed', 'Rejected'] }, user: SEED },
        select: {
            id: true,
            amountVnd: true,
            status: true,
            rejectionReason: true,
            processedAt: true,
            user: { select: { displayName: true, username: true } }
        },
        orderBy: { processedAt: 'desc' },
        take: 20
    })
    for (const w of withdrawals) {
        const processed = w.status === 'Completed'
        rows.push({
            adminUserId: adminId,
            actionType: processed ? 'withdrawal_processed' : 'withdrawal_rejected',
            targetType: 'withdrawal',
            targetId: w.id,
            summary: `${fmtVnd(w.amountVnd)} to ${nameOf(w.user)} · ${processed ? 'Processed' : 'Rejected'}`,
            metadata: processed ? { amountVnd: w.amountVnd } : { amountVnd: w.amountVnd, reason: w.rejectionReason },
            createdAt: w.processedAt ?? new Date()
        })
    }

    const approved = await prisma.gig.findMany({
        where: { status: 'Active', deletedAt: null, sellerId: { in: seedUserIds } },
        select: { id: true, title: true, sellerId: true, approvedAt: true },
        orderBy: { approvedAt: 'desc' },
        take: 20
    })
    for (const g of approved) {
        rows.push({
            adminUserId: adminId,
            actionType: 'gig_approved',
            targetType: 'gig',
            targetId: g.id,
            summary: `"${g.title}" by ${nameById.get(g.sellerId) ?? 'a user'}`,
            metadata: { sellerId: g.sellerId },
            createdAt: g.approvedAt ?? new Date()
        })
    }

    const rejected = await prisma.gig.findMany({
        where: { status: 'Rejected', sellerId: { in: seedUserIds } },
        select: {
            id: true,
            title: true,
            sellerId: true,
            rejectionCategory: true,
            rejectionReason: true,
            updatedAt: true
        },
        orderBy: { updatedAt: 'desc' },
        take: 10
    })
    for (const g of rejected) {
        rows.push({
            adminUserId: adminId,
            actionType: 'gig_rejected',
            targetType: 'gig',
            targetId: g.id,
            summary: `"${g.title}" by ${nameById.get(g.sellerId) ?? 'a user'}`,
            metadata: { sellerId: g.sellerId, category: g.rejectionCategory, reason: g.rejectionReason },
            createdAt: g.updatedAt
        })
    }

    const categories = await prisma.category.findMany({ select: { id: true, name: true, createdAt: true } })
    for (const c of categories) {
        rows.push({
            adminUserId: adminId,
            actionType: 'category_created',
            targetType: 'category',
            targetId: c.id,
            summary: `"${c.name}"`,
            createdAt: c.createdAt
        })
    }

    const endorsed = await prisma.user.findMany({
        where: { ...SEED, endorsedAt: { not: null } },
        select: { id: true, displayName: true, username: true, endorsedAt: true },
        orderBy: { endorsedAt: 'desc' },
        take: 15
    })
    for (const u of endorsed) {
        rows.push({
            adminUserId: adminId,
            actionType: 'user_endorsed',
            targetType: 'user',
            targetId: u.id,
            summary: nameOf(u),
            createdAt: u.endorsedAt ?? new Date()
        })
    }

    if (rows.length > 0) {
        await prisma.adminActivityLog.createMany({ data: rows })
    }
    console.log(`  ✓ ${rows.length} activity log entries backfilled`)
}

// A few sample admin notes + Recent Exports rows so the Users detail modal and
// the Reports page aren't empty on demo data.
async function seedAdminExtras(adminId: string): Promise<void> {
    console.log('  → seeding admin notes + report exports…')

    const noted = await prisma.user.findMany({
        where: { keycloakId: { startsWith: 'seed-' }, endorsedAt: { not: null } },
        select: { id: true },
        take: 3
    })
    const NOTES = [
        'Top performer. Endorsed based on consistent 4.8+ rating across many orders with zero disputes.',
        'Contacted about late deliveries on 2 orders. User was responsive and resolved both.',
        'Long-standing seller with strong reviews — flagged as a candidate for the featured program.'
    ]
    for (let i = 0; i < noted.length; i++) {
        await prisma.user.update({ where: { id: noted[i].id }, data: { adminNote: NOTES[i] } })
    }

    const DAY = 24 * 3600_000
    const now = Date.now()
    const unix = (ms: number) => Math.floor(ms / 1000)
    const exports = [
        { reportType: 'transactions', period: 'this_month', ageDays: 2 },
        { reportType: 'top_sellers', period: 'last_month', ageDays: 18 },
        { reportType: 'transactions', period: 'last_3_months', ageDays: 33 }
    ]
    await prisma.reportExport.createMany({
        data: exports.map((e) => {
            const at = now - e.ageDays * DAY
            return {
                adminUserId: adminId,
                reportType: e.reportType,
                period: e.period,
                filename: `campusgig-${e.reportType.replace(/_/g, '-')}-${unix(at)}.xlsx`,
                createdAt: new Date(at)
            }
        })
    })
    console.log(`  ✓ ${noted.length} admin notes + 3 report exports`)
}

// ── Cleanup (SEED_FORCE) ───────────────────────────────────────────────────

async function cleanupSeedData(): Promise<void> {
    console.log('  → SEED_FORCE=1: wiping previous seed data…')
    // Cascade order: SavedGig → GigImage/Bullet/Faq (via Gig cascade) →
    // Gig (via User cascade isn't set, so delete gigs explicitly) →
    // UserSkill (via User cascade) → User.
    const seedUsers = await prisma.user.findMany({
        where: { keycloakId: { startsWith: 'seed-' } },
        select: { id: true }
    })
    const seedUserIds = seedUsers.map((u: { id: string }) => u.id)
    if (seedUserIds.length === 0) {
        console.log('  ✓ nothing to clean')
        return
    }

    // Transactions + WithdrawalRequests cascade via User.onDelete:Cascade.
    // Messaging tables ALSO cascade via thread/user FKs, but we explicitly
    // delete the dependents first so seed runs are deterministic and we
    // don't depend on cascade ordering for child collections.
    await prisma.messageAttachment.deleteMany({
        where: { message: { thread: { OR: [{ userAId: { in: seedUserIds } }, { userBId: { in: seedUserIds } }] } } }
    })
    await prisma.message.deleteMany({
        where: { thread: { OR: [{ userAId: { in: seedUserIds } }, { userBId: { in: seedUserIds } }] } }
    })
    await prisma.messageReadCursor.deleteMany({
        where: { userId: { in: seedUserIds } }
    })
    await prisma.messageThread.deleteMany({
        where: { OR: [{ userAId: { in: seedUserIds } }, { userBId: { in: seedUserIds } }] }
    })

    await prisma.savedGig.deleteMany({ where: { userId: { in: seedUserIds } } })

    // Phase 1+2 orders chain: DeliveryFile → Delivery → Extension →
    // Cancellation → OrderEvent → Order. Wipe explicitly in reverse
    // dependency order so cleanup is deterministic even if FKs add
    // RESTRICT semantics later.
    const seedOrderIds = await prisma.order.findMany({
        where: {
            OR: [{ buyerId: { in: seedUserIds } }, { sellerId: { in: seedUserIds } }]
        },
        select: { id: true }
    })
    const orderIds = seedOrderIds.map((o: { id: string }) => o.id)
    if (orderIds.length > 0) {
        await prisma.deliveryFile.deleteMany({
            where: { delivery: { orderId: { in: orderIds } } }
        })
        await prisma.delivery.deleteMany({ where: { orderId: { in: orderIds } } })
        await prisma.extension.deleteMany({ where: { orderId: { in: orderIds } } })
        await prisma.cancellation.deleteMany({ where: { orderId: { in: orderIds } } })
        await prisma.review.deleteMany({ where: { orderId: { in: orderIds } } })
        await prisma.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } })
        await prisma.transaction.deleteMany({ where: { orderId: { in: orderIds } } })
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    }

    // F14 — audit log + report exports reference the seed admin (FK is Restrict),
    // so clear them before deleting users.
    await prisma.adminActivityLog.deleteMany({ where: { adminUserId: { in: seedUserIds } } })
    await prisma.reportExport.deleteMany({ where: { adminUserId: { in: seedUserIds } } })

    await prisma.gig.deleteMany({ where: { sellerId: { in: seedUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: seedUserIds } } })
    console.log(`  ✓ removed ${seedUserIds.length} seed users and ${orderIds.length} orders + dependents`)
}

// ── Main ───────────────────────────────────────────────────────────────────

// Synthetic user that owns the platform's 20% take of every completed order.
// Idempotent on keycloakId — runs on EVERY seed pass (even the early-return
// "already seeded" path) so a fresh DB always has the row. Never deleted by
// cleanupSeedData since its keycloakId doesn't start with `seed-`.
//
// The `username` here is a reserved sentinel (`__platform__`) — the unique
// constraint on User.username would otherwise reject a second null-username
// row when exporting dev → prod. See platform.ts for the sentinel scheme.
async function seedPlatformUser(): Promise<void> {
    await prisma.user.upsert({
        where: { keycloakId: 'platform-fee-collector' },
        create: {
            id: '00000000-0000-0000-0000-000000000001',
            keycloakId: 'platform-fee-collector',
            username: '__platform__',
            displayName: 'CampusGig Platform',
            isAdmin: false,
            hasSetUsername: true
        },
        // Idempotent backfill: existing rows from before the sentinel landed
        // get patched on the next seed pass. Safe — the platform row is
        // system-owned, no real user can edit it.
        update: {
            username: '__platform__'
        }
    })
}

async function main(): Promise<void> {
    console.log('🌱 CampusGig seed starting…')
    const start = Date.now()

    await seedPlatformUser()

    const existing = await prisma.user.count({ where: { keycloakId: { startsWith: 'seed-' } } })
    if (existing > 0 && !process.env.SEED_FORCE) {
        console.log(`ℹ ${existing} seed users already present. Pass SEED_FORCE=1 to wipe and reseed.`)
        return
    }

    if (process.env.SEED_FORCE) {
        await cleanupSeedData()
    }

    const categoryIds = await seedCategories()
    const adminId = await seedAdminUser()
    const users = await seedUsers()
    // Attribute the seed users' endorsements to the real seed admin so the
    // Users detail modal can resolve "Endorsed by {admin email}".
    await prisma.user.updateMany({
        where: { keycloakId: { startsWith: 'seed-' }, endorsedAt: { not: null } },
        data: { endorsedBy: adminId }
    })
    const gigs = await seedGigs(users, categoryIds)
    await seedSavedGigs(users, gigs)
    await seedWalletExtras(users)
    await seedMessages(users)
    await seedOrders(users)
    await seedGigViews(gigs)
    await seedDisputes(users)
    await seedAdminActivity(adminId)
    await seedAdminExtras(adminId)

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`✅ Seed complete in ${elapsed}s`)
    console.log(`   • ${CATEGORIES.length} categories`)
    console.log(`   • ${users.length} users`)
    console.log(`   • ${gigs.length} gigs (${gigs.filter((g) => g.status === 'Active').length} active)`)
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
