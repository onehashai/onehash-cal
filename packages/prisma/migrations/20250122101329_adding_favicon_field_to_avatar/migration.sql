/*
  Warnings:

  - A unique constraint covering the columns `[teamId,userId,isBanner,isFavicon]` on the table `avatars` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "avatars_teamId_userId_isBanner_key";

-- AlterTable
ALTER TABLE "avatars" ADD COLUMN     "isFavicon" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "avatars_teamId_userId_isBanner_isFavicon_key" ON "avatars"("teamId", "userId", "isBanner", "isFavicon");
