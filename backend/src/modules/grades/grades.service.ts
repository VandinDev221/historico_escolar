import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { UpsertGradeDto } from './dto/upsert-grade.dto';
import { UpsertGradesBulkDto } from './dto/upsert-grades-bulk.dto';
import { CreateGradeConfigDto } from './dto/create-grade-config.dto';
import { UpdateGradeConfigDto } from './dto/update-grade-config.dto';

/** Calcula a média das 4 notas (apenas das preenchidas). Retorna null se nenhuma estiver preenchida. */
function calcAverageScore(
  s1: number | null | undefined,
  s2: number | null | undefined,
  s3: number | null | undefined,
  s4: number | null | undefined,
): number | null {
  const values = [s1, s2, s3, s4].filter(
    (v): v is number => v != null && typeof v === 'number' && Number.isFinite(v),
  );
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureAccess(enrollmentId: string, userSchoolId: string | null, userRole: UserRole) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { school: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');
    if (userRole !== UserRole.SUPER_ADMIN && enrollment.schoolId !== userSchoolId) {
      throw new ForbiddenException('Acesso negado.');
    }
    return enrollment;
  }

  private async ensureProfessorDiscipline(
    userId: string,
    gradeConfigId: string,
    userRole: UserRole,
  ) {
    if (userRole !== UserRole.PROFESSOR) return;
    const taught = await this.prisma.teacherDiscipline.findUnique({
      where: { userId_gradeConfigId: { userId, gradeConfigId } },
    });
    if (!taught) {
      throw new ForbiddenException('Você não leciona esta disciplina.');
    }
  }

  async upsert(
    enrollmentId: string,
    gradeConfigId: string,
    dto: UpsertGradeDto,
    userSchoolId: string | null,
    userRole: UserRole,
    userId: string,
  ) {
    const enrollment = await this.ensureAccess(enrollmentId, userSchoolId, userRole);
    await this.ensureProfessorDiscipline(userId, gradeConfigId, userRole);
    const hasScores = [dto.score1, dto.score2, dto.score3, dto.score4].some((s) => s != null);
    const score =
      hasScores
        ? calcAverageScore(dto.score1, dto.score2, dto.score3, dto.score4)
        : dto.score != null
          ? dto.score
          : null;
    const gradeData = {
      score1: dto.score1 ?? (hasScores ? null : dto.score ?? null),
      score2: dto.score2 ?? null,
      score3: dto.score3 ?? null,
      score4: dto.score4 ?? null,
      score,
      frequency: dto.frequency,
      recoveryScore: dto.recoveryScore,
      observations: dto.observations,
    };
    return this.prisma.grade.upsert({
      where: {
        enrollmentId_gradeConfigId_bimester: {
          enrollmentId,
          gradeConfigId,
          bimester: dto.bimester,
        },
      },
      create: {
        enrollmentId,
        gradeConfigId,
        bimester: dto.bimester,
        ...gradeData,
      },
      update: gradeData,
      include: { gradeConfig: true },
    });
  }

  async findByEnrollment(
    enrollmentId: string,
    userSchoolId: string | null,
    userRole: UserRole,
    userId: string,
  ) {
    await this.ensureAccess(enrollmentId, userSchoolId, userRole);
    const where: { enrollmentId: string; gradeConfigId?: { in: string[] } } = { enrollmentId };
    if (userRole === UserRole.PROFESSOR) {
      const taught = await this.prisma.teacherDiscipline.findMany({
        where: { userId },
        select: { gradeConfigId: true },
      });
      const ids = taught.map((t) => t.gradeConfigId);
      if (ids.length === 0) return [];
      where.gradeConfigId = { in: ids };
    }
    return this.prisma.grade.findMany({
      where,
      include: { gradeConfig: true },
      orderBy: [{ gradeConfig: { subject: 'asc' } }, { bimester: 'asc' }],
    });
  }

  /** Normaliza série para comparação: trim, lowercase e unifica ° (grau) com º (ordinal) */
  private normalizeSeries(s: string): string {
    let t = (s ?? '').trim().toLowerCase();
    t = t.replace(/\u00B0/g, 'o'); // ° (degree sign) → o
    t = t.replace(/\u00BA/g, 'o'); // º (masculine ordinal) → o
    return t;
  }

  async getGradeConfigs(
    schoolId: string,
    series: string | undefined,
    userSchoolId: string | null,
    userRole: UserRole,
    userId: string,
  ) {
    if (userRole !== UserRole.SUPER_ADMIN && userSchoolId !== schoolId) {
      throw new ForbiddenException('Acesso negado.');
    }
    if (userRole === UserRole.PROFESSOR) {
      const taught = await this.prisma.teacherDiscipline.findMany({
        where: { userId, gradeConfig: { schoolId } },
        select: { gradeConfigId: true },
      });
      const ids = taught.map((t) => t.gradeConfigId);
      if (ids.length === 0) return [];
      const configs = await this.prisma.gradeConfig.findMany({
        where: { id: { in: ids }, schoolId },
        orderBy: { subject: 'asc' },
      });
      if (series?.trim()) {
        const norm = this.normalizeSeries(series);
        return configs.filter((c) => this.normalizeSeries(c.series) === norm);
      }
      return configs;
    }
    const where: { schoolId: string; series?: string } = { schoolId };
    if (series?.trim()) where.series = series;
    return this.prisma.gradeConfig.findMany({
      where,
      orderBy: { subject: 'asc' },
    });
  }

  async getGradeConfigsBySchool(schoolId: string, userSchoolId: string | null, userRole: UserRole) {
    if (userRole !== UserRole.SUPER_ADMIN && userSchoolId !== schoolId) {
      throw new ForbiddenException('Acesso negado.');
    }
    return this.prisma.gradeConfig.findMany({
      where: { schoolId },
      orderBy: [{ series: 'asc' }, { subject: 'asc' }],
    });
  }

  /** Apenas gestor (ADMIN_ESCOLAR) ou SUPER_ADMIN podem criar/editar/excluir disciplinas */
  private ensureSchoolManagerAccess(schoolId: string, userSchoolId: string | null, userRole: UserRole) {
    if (userRole === UserRole.SUPER_ADMIN) return;
    if (userRole !== UserRole.ADMIN_ESCOLAR || userSchoolId !== schoolId) {
      throw new ForbiddenException('Apenas o gestor da escola pode cadastrar ou alterar disciplinas.');
    }
  }

  async createGradeConfig(
    schoolId: string,
    dto: CreateGradeConfigDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolManagerAccess(schoolId, userSchoolId, userRole);
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escola não encontrada.');
    const existing = await this.prisma.gradeConfig.findFirst({
      where: { schoolId, series: dto.series.trim(), subject: dto.subject.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `Já existe a disciplina "${dto.subject}" para a série "${dto.series}" nesta escola.`,
      );
    }
    return this.prisma.gradeConfig.create({
      data: {
        schoolId,
        series: dto.series.trim(),
        subject: dto.subject.trim(),
        workload: dto.workload,
      },
    });
  }

  async updateGradeConfig(
    schoolId: string,
    id: string,
    dto: UpdateGradeConfigDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolManagerAccess(schoolId, userSchoolId, userRole);
    const config = await this.prisma.gradeConfig.findFirst({ where: { id, schoolId } });
    if (!config) throw new NotFoundException('Disciplina não encontrada.');
    const data: { series?: string; subject?: string; workload?: number } = {};
    if (dto.series !== undefined) data.series = dto.series.trim();
    if (dto.subject !== undefined) data.subject = dto.subject.trim();
    if (dto.workload !== undefined) data.workload = dto.workload;
    return this.prisma.gradeConfig.update({
      where: { id },
      data,
    });
  }

  async deleteGradeConfig(
    schoolId: string,
    id: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolManagerAccess(schoolId, userSchoolId, userRole);
    const config = await this.prisma.gradeConfig.findFirst({ where: { id, schoolId } });
    if (!config) throw new NotFoundException('Disciplina não encontrada.');
    await this.prisma.gradeConfig.delete({ where: { id } });
    return { message: 'Disciplina removida com sucesso.' };
  }

  /** Lista alunos da turma com nota/frequência do bimestre na disciplina (para lançamento em lote). */
  async getBulkByTurma(
    schoolId: string,
    turmaId: string,
    gradeConfigId: string,
    bimester: number,
    userSchoolId: string | null,
    userRole: UserRole,
    userId: string,
  ) {
    if (userRole !== UserRole.SUPER_ADMIN && userSchoolId !== schoolId) {
      throw new ForbiddenException('Acesso negado.');
    }
    const turma = await this.prisma.turma.findFirst({
      where: { id: turmaId, schoolId },
      include: {
        enrollments: {
          include: {
            student: { select: { id: true, name: true } },
            grades: {
              where: { gradeConfigId, bimester },
              select: { score: true, score1: true, score2: true, score3: true, score4: true, frequency: true },
            },
          },
          orderBy: { student: { name: 'asc' } },
        },
      },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    const gradeConfig = await this.prisma.gradeConfig.findFirst({
      where: { id: gradeConfigId, schoolId },
    });
    if (!gradeConfig) throw new NotFoundException('Disciplina não encontrada.');
    if (this.normalizeSeries(gradeConfig.series) !== this.normalizeSeries(turma.series)) {
      throw new ForbiddenException('A disciplina não é da mesma série da turma.');
    }
    await this.ensureProfessorDiscipline(userId, gradeConfigId, userRole);

    const enrollmentIds = turma.enrollments.map((e) => e.id);
    // Busca todos os registros de frequência das matrículas da turma.
    // Importante: a matrícula (Enrollment) já é por ano letivo; não filtramos por ano da data
    // para evitar inconsistências (ex.: lançamento feito com ano diferente na UI).
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      select: { enrollmentId: true, present: true, justified: true },
    });
    const byEnrollment: Record<
      string,
      { presencas: number; faltas: number; faltasJustificadas: number }
    > = {};
    for (const id of enrollmentIds) byEnrollment[id] = { presencas: 0, faltas: 0, faltasJustificadas: 0 };
    for (const r of attendanceRecords) {
      const cur = byEnrollment[r.enrollmentId];
      if (!cur) continue;
      if (r.present) cur.presencas++;
      else {
        cur.faltas++;
        if (r.justified) cur.faltasJustificadas++;
      }
    }

    return turma.enrollments.map((e) => {
      const g = e.grades[0];
      const att = byEnrollment[e.id];
      return {
        enrollmentId: e.id,
        studentId: e.student.id,
        studentName: e.student.name,
        score: g?.score ?? null,
        score1: g?.score1 ?? null,
        score2: g?.score2 ?? null,
        score3: g?.score3 ?? null,
        score4: g?.score4 ?? null,
        frequency: g?.frequency ?? null,
        totalPresencas: att?.presencas ?? 0,
        totalFaltas: att?.faltas ?? 0,
        faltasJustificadas: att?.faltasJustificadas ?? 0,
      };
    });
  }

  /** Lança notas/frequência de todos os alunos da turma de uma vez (uma disciplina, um bimestre). */
  async upsertBulk(
    schoolId: string,
    turmaId: string,
    dto: UpsertGradesBulkDto,
    userSchoolId: string | null,
    userRole: UserRole,
    userId: string,
  ) {
    if (userRole !== UserRole.SUPER_ADMIN && userSchoolId !== schoolId) {
      throw new ForbiddenException('Acesso negado.');
    }
    const turma = await this.prisma.turma.findFirst({
      where: { id: turmaId, schoolId },
      select: { id: true, series: true },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    const gradeConfig = await this.prisma.gradeConfig.findFirst({
      where: { id: dto.gradeConfigId, schoolId },
    });
    if (!gradeConfig) throw new NotFoundException('Disciplina não encontrada.');
    if (this.normalizeSeries(gradeConfig.series) !== this.normalizeSeries(turma.series)) {
      throw new ForbiddenException('A disciplina não é da mesma série da turma.');
    }
    await this.ensureProfessorDiscipline(userId, dto.gradeConfigId, userRole);

    const enrollmentIds = await this.prisma.enrollment.findMany({
      where: { turmaId },
      select: { id: true },
    });
    const validIds = new Set(enrollmentIds.map((e) => e.id));

    for (const item of dto.grades) {
      if (!validIds.has(item.enrollmentId)) continue;
      const s1 = item.score1 !== undefined && item.score1 !== null ? item.score1 : undefined;
      const s2 = item.score2 !== undefined && item.score2 !== null ? item.score2 : undefined;
      const s3 = item.score3 !== undefined && item.score3 !== null ? item.score3 : undefined;
      const s4 = item.score4 !== undefined && item.score4 !== null ? item.score4 : undefined;
      const frequency = item.frequency !== undefined && item.frequency !== null ? item.frequency : undefined;
      const score = calcAverageScore(s1, s2, s3, s4);
      const hasScores = s1 !== undefined || s2 !== undefined || s3 !== undefined || s4 !== undefined;
      if (!hasScores && frequency === undefined) continue;
      await this.prisma.grade.upsert({
        where: {
          enrollmentId_gradeConfigId_bimester: {
            enrollmentId: item.enrollmentId,
            gradeConfigId: dto.gradeConfigId,
            bimester: dto.bimester,
          },
        },
        create: {
          enrollmentId: item.enrollmentId,
          gradeConfigId: dto.gradeConfigId,
          bimester: dto.bimester,
          score1: s1 ?? null,
          score2: s2 ?? null,
          score3: s3 ?? null,
          score4: s4 ?? null,
          score: score ?? null,
          frequency: frequency ?? null,
        },
        update: {
          score1: s1 ?? null,
          score2: s2 ?? null,
          score3: s3 ?? null,
          score4: s4 ?? null,
          score: score ?? null,
          ...(frequency !== undefined && { frequency }),
        },
      });
    }
    return { ok: true, message: 'Notas salvas.' };
  }
}
