-- DropIndex
DROP INDEX "BookingReference_credentialId_idx";

-- AlterTable
ALTER TABLE "EventType" ADD COLUMN     "hideCalendarEventDetails" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "bookingLimits" JSONB;

-- AddForeignKey
ALTER TABLE "BookingReference" ADD CONSTRAINT "BookingReference_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
