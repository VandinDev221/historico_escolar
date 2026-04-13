-- DropIndex
DROP INDEX "Enrollment_conselhoTutelarNotifiedById_idx";

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "atestadoImageUrl" VARCHAR(500);
