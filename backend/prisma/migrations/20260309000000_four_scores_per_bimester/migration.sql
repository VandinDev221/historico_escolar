-- AlterTable: 4 notas por bimestre; score continua sendo a média (usado em boletim/relatórios)
ALTER TABLE "Grade" ADD COLUMN "score1" DOUBLE PRECISION;
ALTER TABLE "Grade" ADD COLUMN "score2" DOUBLE PRECISION;
ALTER TABLE "Grade" ADD COLUMN "score3" DOUBLE PRECISION;
ALTER TABLE "Grade" ADD COLUMN "score4" DOUBLE PRECISION;
