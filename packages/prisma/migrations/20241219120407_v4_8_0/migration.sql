/*
  Warnings:

  - The values [TITLE] on the enum `EventTypeAutoTranslatedField` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `requiresConfirmationForFreeEmail` on the `EventType` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `SelectedCalendar` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `SelectedCalendar` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EventTypeAutoTranslatedField_new" AS ENUM ('DESCRIPTION');
ALTER TABLE "EventTypeTranslation" ALTER COLUMN "field" TYPE "EventTypeAutoTranslatedField_new" USING ("field"::text::"EventTypeAutoTranslatedField_new");
ALTER TYPE "EventTypeAutoTranslatedField" RENAME TO "EventTypeAutoTranslatedField_old";
ALTER TYPE "EventTypeAutoTranslatedField_new" RENAME TO "EventTypeAutoTranslatedField";
DROP TYPE "EventTypeAutoTranslatedField_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'AFTER_HOSTS_CAL_VIDEO_NO_SHOW';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowTriggerEvents" ADD VALUE 'AFTER_HOSTS_CAL_VIDEO_NO_SHOW';
ALTER TYPE "WorkflowTriggerEvents" ADD VALUE 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW';

-- DropIndex
DROP INDEX "HashedLink_eventTypeId_key";

-- AlterTable
ALTER TABLE "EventType" DROP COLUMN "requiresConfirmationForFreeEmail";

-- AlterTable
ALTER TABLE "Host" ADD COLUMN     "scheduleId" INTEGER;

-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN     "allowSEOIndexing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orgProfileRedirectsToVerifiedDomain" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SelectedCalendar" DROP COLUMN "error",
DROP COLUMN "id";

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "time" INTEGER,
ADD COLUMN     "timeUnit" "TimeUnit";

-- CreateIndex
CREATE INDEX "Host_scheduleId_idx" ON "Host"("scheduleId");

-- AddForeignKey
ALTER TABLE "Host" ADD CONSTRAINT "Host_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
