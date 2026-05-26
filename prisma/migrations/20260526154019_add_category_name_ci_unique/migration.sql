-- Feature 03 — Case-insensitive uniqueness on Category.name.
-- The Prisma-managed @unique already covers exact-case duplicates.
-- This functional index catches "Tutoring" vs "tutoring" vs "TUTORING".

CREATE UNIQUE INDEX "Category_name_ci_unique" ON "Category" (LOWER("name"));
