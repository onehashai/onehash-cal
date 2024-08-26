-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "smsLockReviewedByAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isPlatformManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsLockReviewedByAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsLockState" "SMSLockState" NOT NULL DEFAULT 'UNLOCKED';
