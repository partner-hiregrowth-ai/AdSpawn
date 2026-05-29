-- AlterTable
ALTER TABLE "DuplicateJob" ADD COLUMN "profileId" TEXT;

-- AddForeignKey
ALTER TABLE "DuplicateJob" ADD CONSTRAINT "DuplicateJob_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
