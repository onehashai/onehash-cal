-- CreateTable
CREATE TABLE "IntegrationUserProfile" (
    "scheduling_url" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "current_organization" TEXT,
    "integrationAccountsUserId" INTEGER NOT NULL,
    "integrationAccountsProvider" "IntegrationProvider" NOT NULL,

    CONSTRAINT "IntegrationUserProfile_pkey" PRIMARY KEY ("integrationAccountsUserId","integrationAccountsProvider")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationUserProfile_integrationAccountsUserId_integratio_key" ON "IntegrationUserProfile"("integrationAccountsUserId", "integrationAccountsProvider");

-- AddForeignKey
ALTER TABLE "IntegrationUserProfile" ADD CONSTRAINT "IntegrationUserProfile_integrationAccountsUserId_integrati_fkey" FOREIGN KEY ("integrationAccountsUserId", "integrationAccountsProvider") REFERENCES "IntegrationAccounts"("userId", "provider") ON DELETE RESTRICT ON UPDATE CASCADE;
