/*
  Warnings:

  - You are about to drop the `IntegrationAccounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IntegrationUserProfile` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[username,organizationId]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[platformOAuthClientId,subscriberUrl]` on the table `Webhook` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SINGLE_SELECT', 'MULTI_SELECT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'BOOKING_NO_SHOW_UPDATED';
ALTER TYPE "WebhookTriggerEvents" ADD VALUE 'RECORDING_TRANSCRIPTION_GENERATED';

-- DropForeignKey
ALTER TABLE "IntegrationAccounts" DROP CONSTRAINT "IntegrationAccounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "IntegrationUserProfile" DROP CONSTRAINT "IntegrationUserProfile_integrationAccountsUserId_integrati_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowReminder" DROP CONSTRAINT "WorkflowReminder_workflowStepId_fkey";

-- AlterTable
ALTER TABLE "AIPhoneCallConfiguration" ADD COLUMN     "schedulerName" TEXT,
ADD COLUMN     "templateType" TEXT NOT NULL DEFAULT 'CUSTOM_TEMPLATE',
ALTER COLUMN "generalPrompt" DROP NOT NULL,
ALTER COLUMN "guestName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "noShowHost" SET DEFAULT false;

-- AlterTable
ALTER TABLE "EventType" ADD COLUMN     "eventTypeColor" JSONB,
ADD COLUMN     "instantMeetingExpiryTimeOffsetInSeconds" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "isRRWeightsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rescheduleWithSameRoundRobinHost" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Host" ADD COLUMN     "weight" INTEGER,
ADD COLUMN     "weightAdjustment" INTEGER;

-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN     "isAdminAPIEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "createdByOAuthClientId" TEXT;

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "platformOAuthClientId" TEXT;

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "isActiveOnAll" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "brandColor" DROP DEFAULT,
ALTER COLUMN "darkBrandColor" DROP DEFAULT;

-- DropTable
DROP TABLE "IntegrationAccounts";

-- DropTable
DROP TABLE "IntegrationUserProfile";

-- DropEnum
DROP TYPE "IntegrationProvider";

-- CreateTable
CREATE TABLE "WorkflowsOnTeams" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,

    CONSTRAINT "WorkflowsOnTeams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeOption" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "type" "AttributeType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "usersCanEditRelation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeToUser" (
    "id" TEXT NOT NULL,
    "memberId" INTEGER NOT NULL,
    "attributeOptionId" TEXT NOT NULL,

    CONSTRAINT "AttributeToUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowsOnTeams_workflowId_idx" ON "WorkflowsOnTeams"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowsOnTeams_teamId_idx" ON "WorkflowsOnTeams"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowsOnTeams_workflowId_teamId_key" ON "WorkflowsOnTeams"("workflowId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_attributeId_value_key" ON "AttributeOption"("attributeId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_slug_key" ON "Attribute"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeToUser_memberId_attributeOptionId_key" ON "AttributeToUser"("memberId", "attributeOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_username_organizationId_key" ON "Profile"("username", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_platformOAuthClientId_subscriberUrl_key" ON "Webhook"("platformOAuthClientId", "subscriberUrl");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_createdByOAuthClientId_fkey" FOREIGN KEY ("createdByOAuthClientId") REFERENCES "PlatformOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_platformOAuthClientId_fkey" FOREIGN KEY ("platformOAuthClientId") REFERENCES "PlatformOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowsOnTeams" ADD CONSTRAINT "WorkflowsOnTeams_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowsOnTeams" ADD CONSTRAINT "WorkflowsOnTeams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowReminder" ADD CONSTRAINT "WorkflowReminder_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeToUser" ADD CONSTRAINT "AttributeToUser_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeToUser" ADD CONSTRAINT "AttributeToUser_attributeOptionId_fkey" FOREIGN KEY ("attributeOptionId") REFERENCES "AttributeOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
