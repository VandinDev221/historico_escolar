-- CreateTable
CREATE TABLE "TeacherDiscipline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gradeConfigId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherDiscipline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherDiscipline_userId_idx" ON "TeacherDiscipline"("userId");

-- CreateIndex
CREATE INDEX "TeacherDiscipline_gradeConfigId_idx" ON "TeacherDiscipline"("gradeConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherDiscipline_userId_gradeConfigId_key" ON "TeacherDiscipline"("userId", "gradeConfigId");

-- AddForeignKey
ALTER TABLE "TeacherDiscipline" ADD CONSTRAINT "TeacherDiscipline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDiscipline" ADD CONSTRAINT "TeacherDiscipline_gradeConfigId_fkey" FOREIGN KEY ("gradeConfigId") REFERENCES "GradeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
