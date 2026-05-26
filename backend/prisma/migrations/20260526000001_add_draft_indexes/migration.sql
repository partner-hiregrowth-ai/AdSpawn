-- CreateIndex
CREATE INDEX "DraftCampaign_userId_status_idx" ON "DraftCampaign"("userId", "status");

-- CreateIndex
CREATE INDEX "DraftCampaign_userId_createdAt_idx" ON "DraftCampaign"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DraftAdSet_userId_idx" ON "DraftAdSet"("userId");

-- CreateIndex
CREATE INDEX "DraftAdSet_draftCampaignId_idx" ON "DraftAdSet"("draftCampaignId");

-- CreateIndex
CREATE INDEX "DraftAd_userId_idx" ON "DraftAd"("userId");

-- CreateIndex
CREATE INDEX "DraftAd_draftAdSetId_idx" ON "DraftAd"("draftAdSetId");
