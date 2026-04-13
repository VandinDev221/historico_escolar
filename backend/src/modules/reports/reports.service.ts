import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { SituacaoMatricula } from '@prisma/client';

const FREQUENCY_MIN_PERCENT = 75;
const SCORE_MIN_AVERAGE = 6;
/** Frequência é armazenada em escala 0-40; 40 = 100%. Valores > 40 são tratados como % (0-100) já gravados e limitados a 100%. */
const FREQUENCY_SCALE_MAX = 40;
const toFreqPercent = (f: number) =>
  f <= FREQUENCY_SCALE_MAX ? (f / FREQUENCY_SCALE_MAX) * 100 : Math.min(100, f);

export interface DashboardStats {
  year: number;
  schoolId: string;
  totalMatriculas: number;
  porSituacao: Record<SituacaoMatricula, number>;
  porSerie: Record<string, number>;
  porBairro: Record<string, number>;
  evasaoPercent: number;
  conclusaoPercent: number;
  aprovacaoPercent: number;
  reprovacaoPercent: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureSchoolAccess(schoolId: string, userSchoolId: string | null, userRole: UserRole) {
    if (userRole === UserRole.SUPER_ADMIN) return;
    if (userSchoolId !== schoolId) throw new ForbiddenException('Acesso negado a dados de outra escola.');
  }

  async getDashboard(
    schoolId: string,
    year: number,
    userSchoolId: string | null,
    userRole: UserRole,
  ): Promise<DashboardStats> {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);

    const [total, bySituation, bySeries, byBairro, enrollmentsForGrades] = await Promise.all([
      this.prisma.enrollment.count({ where: { schoolId, year } }),
      this.prisma.enrollment.groupBy({
        by: ['situation'],
        where: { schoolId, year },
        _count: true,
      }),
      this.prisma.enrollment.groupBy({
        by: ['series'],
        where: { schoolId, year },
        _count: true,
      }),
      this.prisma.enrollment.findMany({
        where: { schoolId, year },
        select: { student: { select: { neighborhood: true } } },
      }),
      this.prisma.enrollment.findMany({
        where: { schoolId, year },
        select: { id: true, grades: { select: { score: true, frequency: true, recoveryScore: true } } },
      }),
    ]);

    const porSituacao: Record<SituacaoMatricula, number> = {
      CURSANDO: 0,
      CONCLUIDO: 0,
      TRANSFERIDO: 0,
      EVADIDO: 0,
    };
    bySituation.forEach((r) => {
      porSituacao[r.situation] = r._count;
    });

    const porSerie: Record<string, number> = {};
    bySeries.forEach((r) => {
      porSerie[r.series] = r._count;
    });

    const porBairro: Record<string, number> = {};
    byBairro.forEach((e) => {
      const bairro = e.student.neighborhood?.trim() || 'Não informado';
      porBairro[bairro] = (porBairro[bairro] ?? 0) + 1;
    });

    let aprovados = 0;
    let reprovados = 0;
    for (const e of enrollmentsForGrades) {
      if (e.grades.length > 0) {
        const gradesWithRecovery = e.grades as Array<{ score: number | null; frequency: number | null; recoveryScore?: number | null }>;
        const effectiveScores = gradesWithRecovery
          .filter((g) => g.score != null || (g.recoveryScore != null))
          .map((g) => Math.max(g.score ?? 0, g.recoveryScore ?? 0));
        const freqs = e.grades.map((g) => g.frequency).filter((f): f is number => f != null);
        const avgScore = effectiveScores.length ? effectiveScores.reduce((a, b) => a + b, 0) / effectiveScores.length : 0;
        const avgFreqRaw = freqs.length ? freqs.reduce((a, b) => a + b, 0) / freqs.length : 0;
        const avgFreqPercent = toFreqPercent(avgFreqRaw);
        if (avgScore >= 6 && avgFreqPercent >= FREQUENCY_MIN_PERCENT) aprovados++;
        else if (effectiveScores.length > 0 || freqs.length > 0) reprovados++;
      }
    }

    const totalComNota = aprovados + reprovados;
    const evadido = porSituacao.EVADIDO;
    const concluido = porSituacao.CONCLUIDO;
    const evasaoPercent = total > 0 ? Math.round((evadido / total) * 1000) / 10 : 0;
    const conclusaoPercent = total > 0 ? Math.round((concluido / total) * 1000) / 10 : 0;
    const aprovacaoPercent = totalComNota > 0 ? Math.round((aprovados / totalComNota) * 1000) / 10 : 0;
    const reprovacaoPercent = totalComNota > 0 ? Math.round((reprovados / totalComNota) * 1000) / 10 : 0;

    return {
      year,
      schoolId,
      totalMatriculas: total,
      porSituacao,
      porSerie,
      porBairro,
      evasaoPercent,
      conclusaoPercent,
      aprovacaoPercent,
      reprovacaoPercent,
    };
  }

  async getExportData(
    schoolId: string,
    year: number,
    userSchoolId: string | null,
    userRole: UserRole,
    page = 1,
    limit = 500,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const take = Math.min(Math.max(1, limit), 2000);
    const skip = (Math.max(1, page) - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { schoolId, year },
        include: {
          student: { select: { name: true, birthDate: true, cpf: true } },
        },
        orderBy: [{ series: 'asc' }, { student: { name: 'asc' } }],
        skip,
        take,
      }),
      this.prisma.enrollment.count({ where: { schoolId, year } }),
    ]);

    return {
      items: items.map((e) => ({
        serie: e.series,
        situacao: e.situation,
        nomeAluno: e.student.name,
        dataNascimento: e.student.birthDate,
        cpf: e.student.cpf,
      })),
      total,
      page: Math.max(1, page),
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /** Relatório do diário de classe por turma e período (presenças/faltas por aluno) */
  async getClassDiaryReport(
    schoolId: string,
    turmaId: string,
    startDate: string,
    endDate: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);

    const turma = await this.prisma.turma.findFirst({
      where: { id: turmaId, schoolId },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada para esta escola.');

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new NotFoundException('Período inválido.');
    }
    // normalizar para datas sem hora
    const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, turmaId, situation: 'CURSANDO' },
      include: {
        student: { select: { id: true, name: true } },
        attendanceRecords: {
          where: {
            date: {
              gte: startOnly,
              lte: endOnly,
            },
          },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    const students = enrollments.map((e) => {
      const totalRegistros = e.attendanceRecords.length;
      const presencas = e.attendanceRecords.filter((r) => r.present).length;
      const faltasTotal = totalRegistros - presencas;
      const faltasJustificadas = e.attendanceRecords.filter((r) => !r.present && r.justified).length;
      const faltasInjustificadas = faltasTotal - faltasJustificadas;
      // LDB: frequência para aprovação considera só faltas injustificadas
      const totalParaFreq = presencas + faltasInjustificadas;
      const freqPercent =
        totalParaFreq > 0 ? Math.round((presencas / totalParaFreq) * 1000) / 10 : null;

      return {
        enrollmentId: e.id,
        studentId: e.student.id,
        studentName: e.student.name,
        presencas,
        faltas: faltasTotal,
        faltasJustificadas,
        faltasInjustificadas,
        frequencyPercent: freqPercent,
      };
    });

    return {
      turma: {
        id: turma.id,
        name: turma.name,
        series: turma.series,
        year: turma.year,
        turno: turma.turno,
      },
      period: {
        startDate: startOnly.toISOString().slice(0, 10),
        endDate: endOnly.toISOString().slice(0, 10),
      },
      students,
    };
  }

  /** LDB: alunos com frequência < 75% e lista para notificação Conselho Tutelar */
  async getAlerts(
    schoolId: string,
    year: number,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, year, situation: 'CURSANDO' },
      include: {
        student: { select: { id: true, name: true, birthDate: true } },
        grades: { select: { frequency: true, score: true, recoveryScore: true, gradeConfig: { select: { subject: true } } } },
        conselhoTutelarNotifiedBy: { select: { id: true, name: true } },
      },
    });
    const lowFrequency: typeof enrollments = [];
    const conselhoTutelar: typeof enrollments = [];
    for (const e of enrollments) {
      const freqs = e.grades.map((g) => g.frequency).filter((f): f is number => f != null);
      const avgFreqRaw = freqs.length ? freqs.reduce((a, b) => a + b, 0) / freqs.length : 0;
      const avgFreqPercent = toFreqPercent(avgFreqRaw);
      if (e.grades.length > 0 && avgFreqPercent < FREQUENCY_MIN_PERCENT) {
        lowFrequency.push(e);
        if (!e.conselhoTutelarNotifiedAt) conselhoTutelar.push(e);
      }
    }
    return {
      lowFrequency: lowFrequency.map((e) => ({
        id: e.id,
        student: e.student,
        series: e.series,
        year: e.year,
        avgFrequency: (() => {
          const f = e.grades.map((g) => g.frequency).filter((x): x is number => x != null);
          const avg = f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
          return toFreqPercent(avg);
        })(),
        conselhoTutelarNotifiedAt: e.conselhoTutelarNotifiedAt,
        conselhoTutelarNotifiedBy: e.conselhoTutelarNotifiedBy,
      })),
      conselhoTutelar: conselhoTutelar.map((e) => ({
        id: e.id,
        student: e.student,
        series: e.series,
        year: e.year,
        conselhoTutelarNotifiedAt: e.conselhoTutelarNotifiedAt,
      })),
    };
  }

  async notifyConselhoTutelar(
    enrollmentId: string,
    userId: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, schoolId: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');
    this.ensureSchoolAccess(enrollment.schoolId, userSchoolId, userRole);
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { conselhoTutelarNotifiedAt: new Date(), conselhoTutelarNotifiedById: userId },
      include: { student: { select: { name: true } } },
    });
  }

  /** Alunos em recuperação: pelo menos uma disciplina com média < 6 (ou recuperação não preenchida) */
  async getRecovery(schoolId: string, year: number, userSchoolId: string | null, userRole: UserRole) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId, year },
      include: {
        student: { select: { id: true, name: true } },
        grades: {
          select: {
            score: true,
            recoveryScore: true,
            bimester: true,
            gradeConfig: { select: { subject: true, workload: true } },
          },
        },
      },
    });
    const result: Array<{
      enrollmentId: string;
      student: { id: string; name: string };
      series: string;
      year: number;
      disciplines: Array<{ subject: string; avgScore: number; recoveryScore: number | null; inRecovery: boolean }>;
    }> = [];
    for (const e of enrollments) {
      const bySubject = new Map<string, { scores: number[]; recoveryScores: (number | null)[] }>();
      for (const g of e.grades) {
        const sub = g.gradeConfig.subject;
        if (!bySubject.has(sub)) bySubject.set(sub, { scores: [], recoveryScores: [] });
        const entry = bySubject.get(sub)!;
        if (g.score != null) entry.scores.push(g.score);
        if (g.recoveryScore != null) entry.recoveryScores.push(g.recoveryScore);
      }
      const disciplines: Array<{ subject: string; avgScore: number; recoveryScore: number | null; inRecovery: boolean }> = [];
      let hasAnyRecovery = false;
      for (const [subject, { scores, recoveryScores }] of bySubject.entries()) {
        const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const recoveryScore = recoveryScores.length ? recoveryScores[recoveryScores.length - 1] ?? null : null;
        const effective = Math.max(avgScore, recoveryScore ?? 0);
        const inRecovery = avgScore < SCORE_MIN_AVERAGE && (recoveryScore == null || recoveryScore < SCORE_MIN_AVERAGE);
        if (avgScore < SCORE_MIN_AVERAGE) hasAnyRecovery = true;
        disciplines.push({ subject, avgScore, recoveryScore, inRecovery });
      }
      if (hasAnyRecovery)
        result.push({
          enrollmentId: e.id,
          student: e.student,
          series: e.series,
          year: e.year,
          disciplines,
        });
    }
    return { items: result };
  }

  /** Boletim: notas e frequência por disciplina/bimestre para uma matrícula */
  async getBoletim(
    enrollmentId: string,
    userSchoolId: string | null,
    userRole: UserRole,
    userId?: string,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, name: true, birthDate: true } },
        school: { select: { id: true, name: true } },
        grades: {
          select: {
            bimester: true,
            score: true,
            frequency: true,
            recoveryScore: true,
            gradeConfig: { select: { subject: true, workload: true } },
          },
        },
      },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');
    if (userRole === UserRole.PAIS_RESPONSAVEL) {
      if (!userId) throw new ForbiddenException('Acesso negado.');
      const link = await this.prisma.studentGuardian.findUnique({
        where: { studentId_userId: { studentId: enrollment.studentId, userId } },
      });
      if (!link) throw new ForbiddenException('Acesso negado: você não é responsável por este aluno.');
    } else {
      this.ensureSchoolAccess(enrollment.schoolId, userSchoolId, userRole);
    }

    const bySubject = new Map<string, Array<{ bimester: number; score: number | null; frequency: number | null; recoveryScore: number | null }>>();
    for (const g of enrollment.grades) {
      const sub = g.gradeConfig.subject;
      if (!bySubject.has(sub)) bySubject.set(sub, []);
      bySubject.get(sub)!.push({
        bimester: g.bimester,
        score: g.score,
        frequency: g.frequency,
        recoveryScore: g.recoveryScore,
      });
    }
    const disciplines = Array.from(bySubject.entries()).map(([subject, periods]) => {
      const sorted = [...periods].sort((a, b) => a.bimester - b.bimester);
      const scores = sorted.map((p) => p.score).filter((s): s is number => s != null);
      const freqs = sorted.map((p) => p.frequency).filter((f): f is number => f != null);
      const workload = enrollment.grades.find((gr) => gr.gradeConfig.subject === subject)?.gradeConfig.workload ?? 0;
      const avgFreqRaw = freqs.length ? freqs.reduce((a, b) => a + b, 0) / freqs.length : null;
      return {
        subject,
        workload,
        bimesters: sorted,
        avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        avgFrequency: avgFreqRaw != null ? toFreqPercent(avgFreqRaw) : null,
      };
    });
    return {
      student: enrollment.student,
      school: enrollment.school,
      enrollment: { id: enrollment.id, year: enrollment.year, series: enrollment.series, situation: enrollment.situation },
      disciplines,
    };
  }
}
