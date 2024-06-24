/*
  Warnings:

  - You are about to drop the column `avatar` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `away` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `smsLockState` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "avatar",
DROP COLUMN "away",
DROP COLUMN "smsLockState";
