-- AlterTable.sql

-- Add 'avatar' column to 'users' table if it does not exist
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "avatar" TEXT,
ADD COLUMN IF NOT EXISTS "away" BOOLEAN NOT NULL DEFAULT false;



