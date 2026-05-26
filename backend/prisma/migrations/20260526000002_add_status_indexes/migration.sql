-- CreateIndex
CREATE INDEX "DraftAdSet_userId_status_idx" ON "DraftAdSet"("userId", "status");

-- CreateIndex
CREATE INDEX "DraftAd_userId_status_idx" ON "DraftAd"("userId", "status");
