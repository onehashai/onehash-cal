-- AlterTable
ALTER TABLE "users" ADD COLUMN     "smsLockState" "SMSLockState" NOT NULL DEFAULT 'UNLOCKED';
