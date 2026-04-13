import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { DocumentType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { GenerateDeclarationDto } from './dto/generate-declaration.dto';
import { PdfGeneratorService } from './pdf-generator.service';
import { SchoolsService } from '../schools/schools.service';

const DEFAULT_MIN_FREQUENCY = 75;
const DEFAULT_MIN_SCORE = 6;
/** Frequência é armazenada em escala 0-40; 40 = 100%. Valores > 40 são tratados como % (0-100) já gravados e limitados a 100%. */
const FREQUENCY_SCALE_MAX = 40;
const toFreqPercent = (f: number) =>
  f <= FREQUENCY_SCALE_MAX ? (f / FREQUENCY_SCALE_MAX) * 100 : Math.min(100, f);

interface GradeWithConfig {
  score: number | null;
  frequency: number | null;
  recoveryScore: number | null;
  bimester: number;
  gradeConfig: { subject: string };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly schoolsService: SchoolsService,
  ) {}

  private ensureSchoolAccess(schoolId: string, userSchoolId: string | null, userRole: UserRole) {
    if (userRole === UserRole.SUPER_ADMIN) return;
    if (userSchoolId !== schoolId) throw new ForbiddenException('Acesso negado a dados de outra escola.');
  }

  private makeValidationCode(): string {
    return randomBytes(8).toString('hex').toUpperCase();
  }

  /**
   * Valida se a matrícula atende à LDB (notas e frequência mínima) para o tipo de declaração.
   * Usa regras de promoção configuráveis quando rule é passado.
   */
  private validateEnrollmentGradesForDeclaration(
    type: DocumentType,
    grades: GradeWithConfig[],
    rule?: { minScore: number; minFrequencyPercent: number; useRecoveryScore: boolean },
  ): void {
    const minFreq = rule?.minFrequencyPercent ?? DEFAULT_MIN_FREQUENCY;
    const minScore = rule?.minScore ?? DEFAULT_MIN_SCORE;
    const useRecovery = rule?.useRecoveryScore ?? true;
    if (grades.length === 0) {
      if (type === 'CONCLUSAO') {
        throw new BadRequestException(
          'Não é possível emitir declaração de conclusão: não há notas e frequência lançadas para esta matrícula. Conforme a LDB, a conclusão exige registro de avaliação e frequência.',
        );
      }
      if (type === 'TRANSFERENCIA') {
        throw new BadRequestException(
          'Não é possível emitir declaração de transferência: não há notas e frequência lançadas para esta matrícula. É obrigatório o registro para documentar o período cursado.',
        );
      }
      if (type === 'FREQUENCIA') {
        throw new BadRequestException(
          'Não é possível emitir declaração de frequência: não há frequência lançada para esta matrícula.',
        );
      }
    }

    const freqs = grades.map((g) => g.frequency).filter((f): f is number => f != null);
    const effectiveScores = grades
      .filter((g) => g.score != null || g.recoveryScore != null)
      .map((g) => (useRecovery ? Math.max(g.score ?? 0, g.recoveryScore ?? 0) : (g.score ?? 0)));
    const avgScore = effectiveScores.length > 0 ? effectiveScores.reduce((a, b) => a + b, 0) / effectiveScores.length : 0;
    const avgFreqRaw = freqs.length > 0 ? freqs.reduce((a, b) => a + b, 0) / freqs.length : 0;
    const avgFreq = toFreqPercent(avgFreqRaw);

    if (type === 'FREQUENCIA' && freqs.length === 0) {
      throw new BadRequestException(
        'Não é possível emitir declaração de frequência: nenhum registro de frequência encontrado para esta matrícula.',
      );
    }

    if (type === 'CONCLUSAO' || type === 'TRANSFERENCIA') {
      if (effectiveScores.length === 0) {
        throw new BadRequestException(
          'Não é possível emitir esta declaração: não há notas lançadas para esta matrícula. O registro de avaliação é obrigatório (LDB).',
        );
      }
      if (freqs.length === 0) {
        throw new BadRequestException(
          'Não é possível emitir esta declaração: não há frequência lançada. O controle de frequência é obrigatório (LDB Art. 24).',
        );
      }
    }

    if (type === 'CONCLUSAO') {
      if (avgFreq < minFreq) {
        throw new BadRequestException(
          `Não é possível emitir declaração de conclusão: a frequência média (${avgFreq.toFixed(1)}%) está abaixo do mínimo de ${minFreq}% (LDB Art. 24).`,
        );
      }
      if (avgScore < minScore) {
        throw new BadRequestException(
          `Não é possível emitir declaração de conclusão: a média das notas (${avgScore.toFixed(1)}) está abaixo do mínimo de ${minScore} para aprovação.`,
        );
      }
    }
  }

  /**
   * Monta texto com resumo de notas e frequência por disciplina (para inclusão no PDF).
   */
  private buildGradesSummaryText(grades: GradeWithConfig[]): string {
    const bySubject = new Map<string, { scores: number[]; freqs: number[] }>();
    for (const g of grades) {
      const sub = g.gradeConfig.subject;
      if (!bySubject.has(sub)) bySubject.set(sub, { scores: [], freqs: [] });
      const entry = bySubject.get(sub)!;
      if (g.score != null) entry.scores.push(g.score);
      if (g.frequency != null) entry.freqs.push(g.frequency);
    }
    const lines: string[] = ['', '--- Resumo de avaliação e frequência (LDB Art. 24) ---', ''];
    let totalScores: number[] = [];
    let totalFreqs: number[] = [];
    for (const [subject, { scores, freqs }] of Array.from(bySubject.entries()).sort()) {
      const avgS = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
      const avgF = freqs.length ? (toFreqPercent(freqs.reduce((a, b) => a + b, 0) / freqs.length)).toFixed(1) + '%' : '-';
      lines.push(`${subject}: Média das notas: ${avgS} | Frequência média: ${avgF}`);
      totalScores = totalScores.concat(scores);
      totalFreqs = totalFreqs.concat(freqs);
    }
    if (totalScores.length || totalFreqs.length) {
      const gAvgS = totalScores.length ? (totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(1) : '-';
      const gAvgF = totalFreqs.length ? (totalFreqs.reduce((a, b) => a + b, 0) / totalFreqs.length).toFixed(1) + '%' : '-';
      lines.push('');
      lines.push(`Média geral: ${gAvgS} | Frequência geral: ${gAvgF}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  async generate(
    schoolId: string,
    dto: GenerateDeclarationDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { municipality: true },
    });
    if (!school) throw new NotFoundException('Escola não encontrada.');

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, schoolId },
      include: { contacts: true },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado nesta escola.');

    let enrollment: { id: string; year: number; series: string; situation: string } | null = null;
    let enrollmentGrades: GradeWithConfig[] = [];

    if (dto.enrollmentId) {
      const enr = await this.prisma.enrollment.findFirst({
        where: { id: dto.enrollmentId, studentId: student.id, schoolId },
        include: { grades: { include: { gradeConfig: true } } },
      });
      if (!enr) throw new NotFoundException('Matrícula não encontrada.');
      enrollment = { id: enr.id, year: enr.year, series: enr.series, situation: enr.situation };
      enrollmentGrades = enr.grades as GradeWithConfig[];
    } else if (['TRANSFERENCIA', 'CONCLUSAO', 'FREQUENCIA'].includes(dto.type)) {
      throw new BadRequestException('Para este tipo de declaração é necessário informar a matrícula (enrollmentId).');
    }

    if (['CONCLUSAO', 'TRANSFERENCIA', 'FREQUENCIA'].includes(dto.type)) {
      let rule: { minScore: number; minFrequencyPercent: number; useRecoveryScore: boolean } | undefined;
      if (dto.type === 'CONCLUSAO' && enrollment) {
        const promotionRule = await this.schoolsService.getPromotionRule(schoolId, enrollment.year, userSchoolId, userRole);
        rule = {
          minScore: promotionRule.minScore,
          minFrequencyPercent: promotionRule.minFrequencyPercent,
          useRecoveryScore: promotionRule.useRecoveryScore,
        };
      }
      this.validateEnrollmentGradesForDeclaration(dto.type, enrollmentGrades, rule);
    }

    const validationCode = this.makeValidationCode();
    const now = new Date();
    const data: Record<string, unknown> = {
      studentName: student.name,
      studentBirthDate: student.birthDate,
      schoolName: school.name,
      municipalityName: school.municipality.name,
      state: school.municipality.state,
      generatedAt: now.toISOString(),
      enrollment: enrollment ? { year: enrollment.year, series: enrollment.series, situation: enrollment.situation } : null,
    };

    let content = this.buildDeclarationContent(dto.type, student.name, school.name, school.municipality.name, school.municipality.state, enrollment, now);

    if ((dto.type === 'CONCLUSAO' || dto.type === 'TRANSFERENCIA') && enrollmentGrades.length > 0) {
      const gradesSummary = this.buildGradesSummaryText(enrollmentGrades);
      data.gradesSummary = gradesSummary;
      content = content + gradesSummary;
    }

    data.content = content;

    const doc = await this.prisma.document.create({
      data: {
        type: dto.type,
        schoolId,
        studentId: student.id,
        enrollmentId: enrollment?.id ?? null,
        data: data as object,
        validationCode,
      },
      include: { student: { select: { name: true } }, school: { select: { name: true } } },
    });

    const baseUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
    return {
      id: doc.id,
      type: doc.type,
      validationCode,
      validateUrl: `${baseUrl}/validar/${validationCode}`,
      content,
      createdAt: doc.createdAt,
    };
  }

  private buildDeclarationContent(
    type: DocumentType,
    studentName: string,
    schoolName: string,
    municipalityName: string,
    state: string,
    enrollment: { year: number; series: string; situation: string } | null,
    date: Date,
  ): string {
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const header = `DECLARAÇÃO\n\nDeclaramos para os devidos fins que:\n\n`;
    const body = (() => {
      switch (type) {
        case 'MATRICULA':
          return `${studentName} está devidamente matriculado(a) nesta unidade escolar (${schoolName}), vinculado(a) à rede municipal de ${municipalityName}/${state}.\n\n`;
        case 'TRANSFERENCIA':
          return enrollment
            ? `${studentName} foi transferido(a) desta unidade (${schoolName}) no ano letivo de ${enrollment.year}, tendo cursado ${enrollment.series}.\n\n`
            : `${studentName} consta em nossos registros como transferido(a) desta unidade (${schoolName}).\n\n`;
        case 'CONCLUSAO':
          return enrollment
            ? `${studentName} concluiu o ano letivo de ${enrollment.year} na série ${enrollment.series} nesta unidade (${schoolName}).\n\n`
            : `${studentName} consta em nossos registros como tendo concluído o período informado.\n\n`;
        case 'FREQUENCIA':
          return enrollment
            ? `${studentName} possui frequência registrada no ano letivo de ${enrollment.year}, série ${enrollment.series}, nesta unidade (${schoolName}).\n\n`
            : `${studentName} possui frequência registrada nesta unidade (${schoolName}).\n\n`;
        default:
          return `${studentName} é aluno(a) vinculado(a) a ${schoolName}.\n\n`;
      }
    })();
    return `${header}${body}${municipalityName}/${state}, ${dateStr}.`;
  }

  async listBySchool(
    schoolId: string,
    userSchoolId: string | null,
    userRole: UserRole,
    page = 1,
    limit = 50,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const take = Math.min(Math.max(1, limit), 200);
    const skip = (Math.max(1, page) - 1) * take;
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where: { schoolId },
        include: { student: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.document.count({ where: { schoolId } }),
    ]);
    return { items, total, page: Math.max(1, page), limit: take, totalPages: Math.ceil(total / take) };
  }

  async listByStudent(
    studentId: string,
    userSchoolId: string | null,
    userRole: UserRole,
    userId?: string,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    if (userRole === UserRole.PAIS_RESPONSAVEL) {
      if (!userId) throw new ForbiddenException('Acesso negado.');
      const link = await this.prisma.studentGuardian.findUnique({
        where: { studentId_userId: { studentId, userId } },
      });
      if (!link) throw new ForbiddenException('Acesso negado: você não é responsável por este aluno.');
    } else {
      this.ensureSchoolAccess(student.schoolId, userSchoolId, userRole);
    }
    return this.prisma.document.findMany({
      where: { studentId },
      include: { school: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateByCode(code: string) {
    const doc = await this.prisma.document.findUnique({
      where: { validationCode: code.toUpperCase() },
      include: { school: { include: { municipality: true } }, student: { select: { name: true } } },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado ou código inválido.');
    const data = doc.data as Record<string, unknown>;
    return {
      type: doc.type,
      studentName: doc.student.name,
      schoolName: doc.school.name,
      municipalityName: doc.school.municipality.name,
      state: doc.school.municipality.state,
      generatedAt: data.generatedAt,
      enrollment: data.enrollment ?? null,
      gradesSummary: data.gradesSummary ?? null,
      valid: true,
    };
  }

  /** Gera PDF da declaração com QR Code (acesso público pelo código de validação). */
  async getPdfByCode(code: string): Promise<{ buffer: Buffer; filename: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { validationCode: code.toUpperCase() },
      include: { student: { select: { name: true } } },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado ou código inválido.');
    const data = doc.data as Record<string, unknown>;
    const content = (data.content as string) || '';
    const baseUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
    const validateUrl = `${baseUrl}/validar/${doc.validationCode}`;
    const title = doc.type === 'HISTORICO_ESCOLAR' ? 'HISTÓRICO ESCOLAR' : 'DECLARAÇÃO';
    const buffer = await this.pdfGenerator.generateDeclarationPdf(content, validateUrl, doc.validationCode, title);
    const safeName = doc.student.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 30);
    const filename = doc.type === 'HISTORICO_ESCOLAR' ? `historico_escolar_${safeName}.pdf` : `declaracao_${doc.type.toLowerCase()}_${safeName}.pdf`;
    return { buffer, filename };
  }

  /** Gera documento Histórico Escolar (todas as matrículas do aluno na escola, com notas e frequência). */
  async generateHistoricoEscolar(
    schoolId: string,
    studentId: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { municipality: true },
    });
    if (!school) throw new NotFoundException('Escola não encontrada.');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado nesta escola.');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId, schoolId },
      include: {
        grades: { include: { gradeConfig: true } },
      },
      orderBy: { year: 'asc' },
    });

    const yearConfigs = await this.prisma.schoolYearConfig.findMany({
      where: { schoolId },
    });
    const yearConfigMap = new Map(yearConfigs.map((c) => [c.year, c]));

    const lines: string[] = [
      'HISTÓRICO ESCOLAR',
      '',
      `Aluno(a): ${student.name}`,
      `Data de nascimento: ${student.birthDate.toLocaleDateString('pt-BR')}`,
      student.cpf ? `CPF: ${student.cpf}` : '',
      '',
      `Escola: ${school.name}`,
      `Município: ${school.municipality.name}/${school.municipality.state}`,
      '',
      '--- Dados por ano letivo ---',
      '',
    ].filter(Boolean);

    if (enrollments.length === 0) {
      lines.push('Nenhuma matrícula registrada para este aluno nesta escola.');
      lines.push('');
    }

    for (const enr of enrollments) {
      const yc = yearConfigMap.get(enr.year);
      const daysLetivos = yc?.daysLetivos ?? 200;
      const cargaAnual = yc?.cargaHorariaAnual ?? 800;
      lines.push(`Ano letivo: ${enr.year}  |  Série: ${enr.series}  |  Situação: ${enr.situation}`);
      lines.push(`Dias letivos (mín. LDB): ${daysLetivos}  |  Carga horária anual: ${cargaAnual}h`);
      lines.push('');

      const bySubject = new Map<string, { workload: number; scores: number[]; freqs: number[]; recoveryScores: (number | null)[] }>();
      for (const g of enr.grades) {
        const sub = g.gradeConfig.subject;
        if (!bySubject.has(sub)) bySubject.set(sub, { workload: g.gradeConfig.workload, scores: [], freqs: [], recoveryScores: [] });
        const e = bySubject.get(sub)!;
        if (g.score != null) e.scores.push(g.score);
        if (g.frequency != null) e.freqs.push(g.frequency);
        e.recoveryScores.push(g.recoveryScore ?? null);
      }

      for (const [subject, { workload, scores, freqs, recoveryScores }] of Array.from(bySubject.entries()).sort()) {
        const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const avgS = scores.length ? avgScore.toFixed(1) : '-';
        const avgF = freqs.length ? (toFreqPercent(freqs.reduce((a, b) => a + b, 0) / freqs.length)).toFixed(1) + '%' : '-';
        const rec = recoveryScores.filter((r): r is number => r != null);
        const finalRec = rec.length ? Math.max(...rec).toFixed(1) : '-';
        const maxRec = rec.length ? Math.max(...rec) : 0;
        const effective = Math.max(avgScore, maxRec);
        const situacao = effective >= DEFAULT_MIN_SCORE ? 'Aprovado' : 'Reprovado';
        lines.push(`  ${subject} (${workload}h): Notas média ${avgS} | Frequência ${avgF} | Rec. ${finalRec} | ${situacao}`);
      }
      lines.push('');
    }

    const content = lines.join('\n');
    const validationCode = this.makeValidationCode();
    const now = new Date();
    const data: Record<string, unknown> = {
      studentName: student.name,
      studentBirthDate: student.birthDate,
      schoolName: school.name,
      municipalityName: school.municipality.name,
      state: school.municipality.state,
      generatedAt: now.toISOString(),
      type: 'HISTORICO_ESCOLAR',
      content,
    };

    await this.prisma.document.create({
      data: {
        type: 'HISTORICO_ESCOLAR',
        schoolId,
        studentId: student.id,
        enrollmentId: null,
        data: data as object,
        validationCode,
      },
    });

    const baseUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
    return {
      validationCode,
      validateUrl: `${baseUrl}/validar/${validationCode}`,
      content,
      createdAt: now,
    };
  }
}
