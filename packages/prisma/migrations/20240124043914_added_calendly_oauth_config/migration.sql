-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('CALENDLY');

-- CreateTable
CREATE TABLE "IntegrationAccounts" (
    "tokenType" TEXT,
    "expiresIn" INTEGER,
    "createdAt" INTEGER,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scope" TEXT,
    "ownerUniqIdentifier" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "IntegrationAccounts_pkey" PRIMARY KEY ("userId","provider")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccounts_userId_provider_key" ON "IntegrationAccounts"("userId", "provider");

-- AddForeignKey
ALTER TABLE "IntegrationAccounts" ADD CONSTRAINT "IntegrationAccounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
