// Maintenance: recompute the denormalized aggregates on Gig + User from the
// source rows — review counts (reviewCount, ratingSumHalfStars, avgRating) and
// the per-gig completedOrderCount. These can drift if rows are removed via
// cascade (e.g. an order hard-delete). Idempotent — safe to re-run any time.
//
//   pnpm exec dotenv -e .env.development -- ts-node prisma/reconcile-review-aggregates.ts
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function reconcileGigs(): Promise<void> {
    const groups = await prisma.review.groupBy({
        by: ['gigId'],
        _count: { _all: true },
        _sum: { ratingHalfStars: true }
    })
    const realById = new Map(groups.map((g) => [g.gigId, { count: g._count._all, sum: g._sum.ratingHalfStars ?? 0 }]))

    const rows = await prisma.gig.findMany({
        select: { id: true, reviewCount: true, ratingSumHalfStars: true, avgRating: true }
    })
    let fixed = 0
    for (const row of rows) {
        const real = realById.get(row.id) ?? { count: 0, sum: 0 }
        const realAvg = real.count > 0 ? real.sum / 2 / real.count : 0
        if (row.reviewCount === real.count && row.ratingSumHalfStars === real.sum && row.avgRating === realAvg) continue
        await prisma.gig.update({
            where: { id: row.id },
            data: { reviewCount: real.count, ratingSumHalfStars: real.sum, avgRating: realAvg }
        })
        fixed++
        console.log(
            `  gig ${row.id}: count ${row.reviewCount}→${real.count}, sum ${row.ratingSumHalfStars}→${real.sum}`
        )
    }
    console.log(`gig: ${fixed} reconciled (${rows.length} scanned)`)
}

async function reconcileCompletedOrders(): Promise<void> {
    const groups = await prisma.order.groupBy({
        by: ['gigId'],
        where: { status: 'Completed' },
        _count: { _all: true }
    })
    const realById = new Map(groups.map((g) => [g.gigId, g._count._all]))

    const rows = await prisma.gig.findMany({ select: { id: true, completedOrderCount: true } })
    let fixed = 0
    for (const row of rows) {
        const real = realById.get(row.id) ?? 0
        if (row.completedOrderCount === real) continue
        await prisma.gig.update({ where: { id: row.id }, data: { completedOrderCount: real } })
        fixed++
        console.log(`  gig ${row.id}: completedOrders ${row.completedOrderCount}→${real}`)
    }
    console.log(`gig completedOrders: ${fixed} reconciled (${rows.length} scanned)`)
}

async function reconcileUsers(): Promise<void> {
    const groups = await prisma.review.groupBy({
        by: ['sellerId'],
        _count: { _all: true },
        _sum: { ratingHalfStars: true }
    })
    const realById = new Map(
        groups.map((g) => [g.sellerId, { count: g._count._all, sum: g._sum.ratingHalfStars ?? 0 }])
    )

    const rows = await prisma.user.findMany({ select: { id: true, reviewCount: true, ratingSumHalfStars: true } })
    let fixed = 0
    for (const row of rows) {
        const real = realById.get(row.id) ?? { count: 0, sum: 0 }
        if (row.reviewCount === real.count && row.ratingSumHalfStars === real.sum) continue
        await prisma.user.update({
            where: { id: row.id },
            data: { reviewCount: real.count, ratingSumHalfStars: real.sum }
        })
        fixed++
        console.log(
            `  user ${row.id}: count ${row.reviewCount}→${real.count}, sum ${row.ratingSumHalfStars}→${real.sum}`
        )
    }
    console.log(`user: ${fixed} reconciled (${rows.length} scanned)`)
}

async function main() {
    console.log('Reconciling review aggregates…')
    await reconcileGigs()
    await reconcileUsers()
    await reconcileCompletedOrders()
    console.log('Done.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
