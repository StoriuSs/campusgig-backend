-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminNote" TEXT;

-- CreateTable
CREATE TABLE "AdminActivityLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminActivityLog_createdAt_idx" ON "AdminActivityLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminActivityLog_actionType_idx" ON "AdminActivityLog"("actionType");

-- CreateIndex
CREATE INDEX "AdminActivityLog_adminUserId_idx" ON "AdminActivityLog"("adminUserId");

-- CreateIndex
CREATE INDEX "ReportExport_createdAt_idx" ON "ReportExport"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AdminActivityLog" ADD CONSTRAINT "AdminActivityLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
