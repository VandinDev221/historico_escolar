-- DropIndex (Enrollment; alinhado ao schema sem @@index em conselhoTutelarNotifiedById)
-- Nota: atestadoImageUrl em AttendanceRecord vai na migração 20260307000000 (tabela só existe a partir dela).
DROP INDEX IF EXISTS "Enrollment_conselhoTutelarNotifiedById_idx";
