-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'TEXT',
    "attachmentName" TEXT,
    "wasReceipt" BOOLEAN NOT NULL DEFAULT false,
    "merchantName" TEXT,
    "amount" DECIMAL(10,2),
    "confidenceScore" DOUBLE PRECISION,
    "rawExtraction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    "subscriptionId" TEXT,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_workspaceId_idx" ON "email_logs"("workspaceId");

-- CreateIndex
CREATE INDEX "email_logs_workspaceId_createdAt_idx" ON "email_logs"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
