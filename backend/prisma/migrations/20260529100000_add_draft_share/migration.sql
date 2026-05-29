-- CreateTable
CREATE TABLE "DraftShare" (
    "id" TEXT NOT NULL,
    "draftCampaignId" TEXT NOT NULL,
    "sharedByProfileId" TEXT NOT NULL,
    "sharedWithProfileId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'view',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftShare_sharedWithProfileId_idx" ON "DraftShare"("sharedWithProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftShare_draftCampaignId_sharedWithProfileId_key" ON "DraftShare"("draftCampaignId", "sharedWithProfileId");

-- AddForeignKey
ALTER TABLE "DraftShare" ADD CONSTRAINT "DraftShare_draftCampaignId_fkey" FOREIGN KEY ("draftCampaignId") REFERENCES "DraftCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftShare" ADD CONSTRAINT "DraftShare_sharedByProfileId_fkey" FOREIGN KEY ("sharedByProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftShare" ADD CONSTRAINT "DraftShare_sharedWithProfileId_fkey" FOREIGN KEY ("sharedWithProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
