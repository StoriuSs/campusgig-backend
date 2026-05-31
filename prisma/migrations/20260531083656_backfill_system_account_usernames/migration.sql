-- Backfill sentinel usernames for system accounts. Postgres allows multiple
-- NULLs on the unique User.username index, but DBeaver's dev → prod export
-- serializes NULLs as empty strings which collide. Scheme defined in
-- shared/constants/platform.ts. Guarded so re-runs are no-ops.

-- Platform-fee collector
UPDATE "User"
SET "username" = '__platform__'
WHERE "keycloakId" = 'platform-fee-collector'
  AND ("username" IS NULL OR "username" = '');

-- Admin accounts
UPDATE "User"
SET "username" = 'admin-' || substring(regexp_replace("keycloakId", '-', '', 'g'), 1, 12)
WHERE "isAdmin" = true
  AND ("username" IS NULL OR "username" = '');
