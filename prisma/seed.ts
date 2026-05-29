import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
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
    await prisma.savedGig.deleteMany({ where: { userId: { in: seedUserIds } } })
    await prisma.gig.deleteMany({ where: { sellerId: { in: seedUserIds } } })
    await prisma.user.deleteMany({ where: { id: { in: seedUserIds } } })
    console.log(`  ✓ removed ${seedUserIds.length} seed users and dependents`)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log('🌱 CampusGig seed starting…')
    const start = Date.now()

    const existing = await prisma.user.count({ where: { keycloakId: { startsWith: 'seed-' } } })
    if (existing > 0 && !process.env.SEED_FORCE) {
        console.log(`ℹ ${existing} seed users already present. Pass SEED_FORCE=1 to wipe and reseed.`)
        return
    }

    if (process.env.SEED_FORCE) {
        await cleanupSeedData()
    }

    const categoryIds = await seedCategories()
    const users = await seedUsers()
    const gigs = await seedGigs(users, categoryIds)
    await seedSavedGigs(users, gigs)
    await seedWalletExtras(users)

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
