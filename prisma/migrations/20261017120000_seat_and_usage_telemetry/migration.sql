-- Catch-up migration: these columns were previously applied with `prisma db push`
-- and never recorded in the migration history. Idempotent so it is safe on
-- databases that already have them.

-- AlterTable
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "billedSeats" INTEGER,
  ADD COLUMN IF NOT EXISTS "seatUnitPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "integrations"
  ADD COLUMN IF NOT EXISTS "activeSeats" INTEGER,
  ADD COLUMN IF NOT EXISTS "billedSeats" INTEGER,
  ADD COLUMN IF NOT EXISTS "wastedAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "wastedSeats" INTEGER,
  ADD COLUMN IF NOT EXISTS "tokenUsageReport" TEXT,
  ADD COLUMN IF NOT EXISTS "lastWarningSentAt" TIMESTAMP(3);
