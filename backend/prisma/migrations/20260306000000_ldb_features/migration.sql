-- AlterEnum: add HISTORICO_ESCOLAR to DocumentType
ALTER TYPE "DocumentType" ADD VALUE 'HISTORICO_ESCOLAR';

-- CreateTable SchoolYearConfig
CREATE TABLE "SchoolYearConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "daysLetivos" INTEGER NOT NULL DEFAULT 200,
    "cargaHorariaAnual" INTEGER NOT NULL DEFAULT 800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolYearConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolYearConfig_schoolId_year_key" ON "SchoolYearConfig"("schoolId", "year");
CREATE INDEX "SchoolYearConfig_schoolId_idx" ON "SchoolYearConfig"("schoolId");

ALTER TABLE "SchoolYearConfig" ADD CONSTRAINT "SchoolYearConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add Conselho Tutelar notification fields to Enrollment
ALTER TABLE "Enrollment" ADD COLUMN "conselhoTutelarNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Enrollment" ADD COLUMN "conselhoTutelarNotifiedById" TEXT;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_conselhoTutelarNotifiedById_fkey" FOREIGN KEY ("conselhoTutelarNotifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Enrollment_conselhoTutelarNotifiedById_idx" ON "Enrollment"("conselhoTutelarNotifiedById");
