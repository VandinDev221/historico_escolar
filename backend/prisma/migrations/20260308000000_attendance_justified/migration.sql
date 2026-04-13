-- Justificativa de falta (admin da escola): campos em AttendanceRecord
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "justified" BOOLEAN DEFAULT false;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "justifiedAt" TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "justifiedById" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "justifiedNote" VARCHAR(500);

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_justifiedById_fkey"
  FOREIGN KEY ("justifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
