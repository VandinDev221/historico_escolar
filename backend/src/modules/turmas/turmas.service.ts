import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { UpsertDiaryDto } from './dto/upsert-diary.dto';
import { JustifyAbsenceDto } from './dto/justify-absence.dto';

export interface AtestadoImageFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

// Turno do Prisma (usar após prisma generate)
type TurnoPrisma = 'MANHA' | 'TARDE' | 'NOITE';

@Injectable()
export class TurmasService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureSchoolAccess(schoolId: string, userSchoolId: string | null, userRole: UserRole) {
    if (userRole === UserRole.SUPER_ADMIN) return;
    if (userSchoolId !== schoolId) throw new ForbiddenException('Acesso negado a dados de outra escola.');
  }

  async create(
    schoolId: string,
    dto: CreateTurmaDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN_ESCOLAR) {
      throw new ForbiddenException('Apenas gestores podem criar turmas.');
    }
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escola não encontrada.');
    const existing = await this.prisma.turma.findUnique({
      where: { schoolId_year_name: { schoolId, year: dto.year, name: dto.name } },
    });
    if (existing) throw new ConflictException('Já existe uma turma com este nome neste ano.');
    return this.prisma.turma.create({
      data: {
        schoolId,
        year: dto.year,
        series: dto.series,
        name: dto.name,
        turno: (dto.turno ?? null) as TurnoPrisma | null,
      },
    });
  }

  async findBySchool(
    schoolId: string,
    year: number,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    return this.prisma.turma.findMany({
      where: { schoolId, year },
      include: { _count: { select: { enrollments: true } } },
      orderBy: [{ series: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(turmaId: string, userSchoolId: string | null, userRole: UserRole) {
    const turma = await this.prisma.turma.findUnique({
      where: { id: turmaId },
      include: { school: true },
    });
    if (!turma) throw new NotFoundException('Turma não encontrada.');
    this.ensureSchoolAccess(turma.schoolId, userSchoolId, userRole);
    return turma;
  }

  async update(
    turmaId: string,
    dto: UpdateTurmaDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const turma = await this.findOne(turmaId, userSchoolId, userRole);
    if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN_ESCOLAR) {
      throw new ForbiddenException('Apenas gestores podem editar turmas.');
    }
    if (dto.name !== undefined && dto.name !== turma.name) {
      const existing = await this.prisma.turma.findUnique({
        where: { schoolId_year_name: { schoolId: turma.schoolId, year: turma.year, name: dto.name } },
      });
      if (existing) throw new ConflictException('Já existe uma turma com este nome neste ano.');
    }
    return this.prisma.turma.update({
      where: { id: turmaId },
      data: {
        ...(dto.series !== undefined && { series: dto.series }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.turno !== undefined && { turno: dto.turno }),
      },
    });
  }

  async remove(turmaId: string, userSchoolId: string | null, userRole: UserRole) {
    await this.findOne(turmaId, userSchoolId, userRole);
    if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN_ESCOLAR) {
      throw new ForbiddenException('Apenas gestores podem excluir turmas.');
    }
    await this.prisma.enrollment.updateMany({ where: { turmaId }, data: { turmaId: null } });
    return this.prisma.turma.delete({ where: { id: turmaId } });
  }

  /** Lista de chamada: matrículas da turma com presença no dia */
  async getDiary(
    turmaId: string,
    dateStr: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const turma = await this.findOne(turmaId, userSchoolId, userRole);
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) throw new NotFoundException('Data inválida.');
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const enrollments = await this.prisma.enrollment.findMany({
      where: { turmaId, situation: 'CURSANDO' },
      include: {
        student: { select: { id: true, name: true } },
        attendanceRecords: {
          where: { date: dateOnly },
          take: 1,
          include: { justifiedBy: { select: { name: true } } },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    return {
      turma: { id: turma.id, name: turma.name, series: turma.series, year: turma.year },
      date: dateOnly.toISOString().slice(0, 10),
      items: enrollments.map((e) => {
        const rec = e.attendanceRecords[0];
        return {
          enrollmentId: e.id,
          studentName: e.student.name,
          studentId: e.student.id,
          present: rec?.present ?? true,
          attendanceRecordId: rec?.id ?? null,
          justified: rec?.justified ?? false,
          justifiedAt: rec?.justifiedAt ?? null,
          justifiedNote: rec?.justifiedNote ?? null,
          atestadoDocRef: rec?.atestadoDocRef ?? null,
          atestadoImageUrl: rec?.atestadoImageUrl ?? null,
          justifiedByName: rec?.justifiedBy?.name ?? null,
        };
      }),
    };
  }

  /** Registrar presenças/faltas do dia (diário de classe). Após salvar, só admin pode alterar. */
  async upsertDiary(
    turmaId: string,
    dto: UpsertDiaryDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const turma = await this.findOne(turmaId, userSchoolId, userRole);
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) throw new NotFoundException('Data inválida.');
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (userRole === UserRole.PROFESSOR) {
      const alreadySaved = await this.prisma.attendanceRecord.count({
        where: { date: dateOnly, enrollment: { turmaId } },
      });
      if (alreadySaved > 0) {
        throw new ForbiddenException(
          'O diário desta data já foi salvo. Apenas o admin da escola pode alterar.',
        );
      }
    }

    for (const r of dto.records) {
      const enr = await this.prisma.enrollment.findFirst({
        where: { id: r.enrollmentId, turmaId },
      });
      if (!enr) continue;
      await this.prisma.attendanceRecord.upsert({
        where: {
          enrollmentId_date: { enrollmentId: r.enrollmentId, date: dateOnly },
        },
        create: { enrollmentId: r.enrollmentId, date: dateOnly, present: r.present },
        update: { present: r.present },
      });
    }
    return this.getDiary(turmaId, dto.date, userSchoolId, userRole);
  }

  /** Justificar falta (atestado etc.) — apenas admin da escola. Opcionalmente recebe imagem do atestado. */
  async justifyAbsence(
    schoolId: string,
    turmaId: string,
    recordId: string,
    userId: string,
    dto: JustifyAbsenceDto,
    userSchoolId: string | null,
    userRole: UserRole,
    file?: AtestadoImageFile,
  ) {
    if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN_ESCOLAR) {
      throw new ForbiddenException('Apenas o admin da escola pode justificar falta.');
    }
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { enrollment: { select: { id: true, turmaId: true, schoolId: true } } },
    });
    if (!record) throw new NotFoundException('Registro de frequência não encontrado.');
    if (record.enrollment.turmaId !== turmaId || record.enrollment.schoolId !== schoolId) {
      throw new ForbiddenException('Registro não pertence a esta turma/escola.');
    }
    if (record.present) {
      throw new ForbiddenException('Só é possível justificar falta (presença não precisa justificativa).');
    }

    let atestadoImageUrl: string | null = null;
    if (file?.buffer?.length) {
      const ext = this.getImageExtension(file.mimetype, file.originalname);
      const dir = path.join(process.cwd(), 'uploads', 'atestados');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `${recordId}_${Date.now()}${ext}`;
      const relativePath = path.join('atestados', filename);
      const fullPath = path.join(dir, filename);
      fs.writeFileSync(fullPath, file.buffer);
      atestadoImageUrl = relativePath.replace(/\\/g, '/');
    }

    await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        justified: true,
        justifiedAt: new Date(),
        justifiedById: userId,
        justifiedNote: dto.note ?? null,
        atestadoDocRef: dto.atestadoDocRef ?? null,
        atestadoImageUrl,
      },
    });
    return { ok: true, message: 'Falta justificada.' };
  }

  private getImageExtension(mimetype: string, originalname: string): string {
    const fromMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    if (fromMime[mimetype]) return fromMime[mimetype];
    const ext = path.extname(originalname || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return ext;
    return '.jpg';
  }

  /** Retorna o caminho absoluto da imagem do atestado para o registro, se existir e o usuário tiver acesso. */
  async getAtestadoImagePath(
    recordId: string,
    schoolId: string,
    turmaId: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ): Promise<{ fullPath: string; mimetype: string } | null> {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { enrollment: { select: { turmaId: true, schoolId: true } } },
    });
    if (!record?.atestadoImageUrl || record.enrollment.turmaId !== turmaId || record.enrollment.schoolId !== schoolId) {
      return null;
    }
    const fullPath = path.join(process.cwd(), 'uploads', record.atestadoImageUrl);
    if (!fs.existsSync(fullPath)) return null;
    const ext = path.extname(record.atestadoImageUrl).toLowerCase();
    const mime: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
    return { fullPath, mimetype: mime[ext] ?? 'image/jpeg' };
  }
}
