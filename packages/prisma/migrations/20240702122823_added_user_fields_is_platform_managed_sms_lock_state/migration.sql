-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isPlatformManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsLockState" "SMSLockState" NOT NULL DEFAULT 'UNLOCKED';
