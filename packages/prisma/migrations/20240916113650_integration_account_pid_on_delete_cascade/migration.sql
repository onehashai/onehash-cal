/*
  Warnings:

  - The primary key for the `IntegrationAccounts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `IntegrationUserProfile` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "IntegrationAccounts" DROP CONSTRAINT "IntegrationAccounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "IntegrationUserProfile" DROP CONSTRAINT "IntegrationUserProfile_integrationAccountsUserId_integrati_fkey";

-- AlterTable
ALTER TABLE "IntegrationAccounts" DROP CONSTRAINT "IntegrationAccounts_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "IntegrationAccounts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "IntegrationUserProfile" DROP CONSTRAINT "IntegrationUserProfile_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "IntegrationUserProfile_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "IntegrationAccounts" ADD CONSTRAINT "IntegrationAccounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationUserProfile" ADD CONSTRAINT "IntegrationUserProfile_integrationAccountsUserId_integrati_fkey" FOREIGN KEY ("integrationAccountsUserId", "integrationAccountsProvider") REFERENCES "IntegrationAccounts"("userId", "provider") ON DELETE CASCADE ON UPDATE CASCADE;
