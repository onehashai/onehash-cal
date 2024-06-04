-- CreateTable
CREATE TABLE "KeycloakSessionInfo" (
    "id" SERIAL NOT NULL,
    "browserToken" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "KeycloakSessionInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KeycloakSessionInfo_browserToken_key" ON "KeycloakSessionInfo"("browserToken");
