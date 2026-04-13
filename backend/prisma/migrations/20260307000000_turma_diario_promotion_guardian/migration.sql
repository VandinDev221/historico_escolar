-- CreateEnum Turno
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE', 'NOITE');

-- CreateEnum GuardianRelation
CREATE TYPE "GuardianRelation" AS ENUM ('MAE', 'PAI', 'RESPONSAVEL', 'OUTRO');

-- CreateTable Turma
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "turno" "Turno",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Turma_schoolId_year_name_key" ON "Turma"("schoolId", "year", "name");
CREATE INDEX "Turma_schoolId_year_idx" ON "Turma"("schoolId", "year");

ALTER TABLE "Turma" ADD CONSTRAINT "Turma_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable PromotionRule
CREATE TABLE "PromotionRule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER,
    "minScore" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "minFrequencyPercent" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "useRecoveryScore" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionRule_schoolId_year_key" ON "PromotionRule"("schoolId", "year");
CREATE INDEX "PromotionRule_schoolId_idx" ON "PromotionRule"("schoolId");

ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable StudentGuardian
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relation" "GuardianRelation" NOT NULL DEFAULT 'RESPONSAVEL',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentGuardian_studentId_userId_key" ON "StudentGuardian"("studentId", "userId");
CREATE INDEX "StudentGuardian_userId_idx" ON "StudentGuardian"("userId");
CREATE INDEX "StudentGuardian_studentId_idx" ON "StudentGuardian"("studentId");

ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add turmaId to Enrollment
ALTER TABLE "Enrollment" ADD COLUMN "turmaId" TEXT;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Enrollment_turmaId_idx" ON "Enrollment"("turmaId");

-- CreateTable AttendanceRecord
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "atestadoImageUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceRecord_enrollmentId_date_key" ON "AttendanceRecord"("enrollmentId", "date");
CREATE INDEX "AttendanceRecord_enrollmentId_idx" ON "AttendanceRecord"("enrollmentId");
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
