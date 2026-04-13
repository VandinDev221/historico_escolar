-- Add column code (nullable first for existing rows)
ALTER TABLE "TeacherDiscipline" ADD COLUMN "code" TEXT;

-- Backfill: use id as unique code for existing rows
UPDATE "TeacherDiscipline" SET "code" = "id" WHERE "code" IS NULL;

-- Make code required and unique
ALTER TABLE "TeacherDiscipline" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "TeacherDiscipline_code_key" ON "TeacherDiscipline"("code");
CREATE INDEX "TeacherDiscipline_code_idx" ON "TeacherDiscipline"("code");
