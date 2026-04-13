import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AddGuardianDto } from './dto/add-guardian.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureSchoolAccess(schoolId: string | null, userSchoolId: string | null, userRole: UserRole) {
    if (userRole === UserRole.SUPER_ADMIN) return;
    if (userSchoolId !== schoolId) {
      throw new ForbiddenException('Acesso negado a dados de outra escola.');
    }
  }

  async create(schoolId: string, dto: CreateStudentDto, userSchoolId: string | null, userRole: UserRole) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const { contacts, ...data } = dto;
    return this.prisma.student.create({
      data: {
        ...data,
        birthDate: new Date(dto.birthDate),
        schoolId,
        contacts: contacts?.length
          ? { create: contacts.map((c) => ({ ...c, isPrimary: c.isPrimary ?? false })) }
          : undefined,
      },
      include: { contacts: true },
    });
  }

  async findAll(
    schoolId: string,
    userSchoolId: string | null,
    userRole: UserRole,
    page = 1,
    limit = 50,
    search?: string,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const take = Math.min(Math.max(1, limit), 200);
    const skip = (Math.max(1, page) - 1) * take;
    const term = (search || '').trim();
    const where = term.length < 2
      ? { schoolId }
      : {
          schoolId,
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            ...(term.match(/^[\d.\-]+$/) ? [{ cpf: { contains: term } }] : []),
          ],
        };
    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: { contacts: true },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.student.count({ where }),
    ]);
    return { items, total, page: Math.max(1, page), limit: take, totalPages: Math.ceil(total / take) };
  }

  async findOne(id: string, userSchoolId: string | null, userRole: UserRole) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { contacts: true, school: true, enrollments: { include: { grades: true, turma: true } } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    this.ensureSchoolAccess(student.schoolId, userSchoolId, userRole);
    return student;
  }

  async update(id: string, dto: UpdateStudentDto, userSchoolId: string | null, userRole: UserRole) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    this.ensureSchoolAccess(student.schoolId, userSchoolId, userRole);
    const { contacts, ...data } = dto;
    if (contacts) {
      await this.prisma.studentContact.deleteMany({ where: { studentId: id } });
    }
    return this.prisma.student.update({
      where: { id },
      data: {
        ...data,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        contacts: contacts?.length
          ? { create: contacts.map((c) => ({ ...c, isPrimary: c.isPrimary ?? false })) }
          : undefined,
      },
      include: { contacts: true },
    });
  }

  async remove(id: string, userSchoolId: string | null, userRole: UserRole) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    this.ensureSchoolAccess(student.schoolId, userSchoolId, userRole);
    await this.prisma.student.delete({ where: { id } });
    return { message: 'Aluno removido com sucesso.' };
  }

  async listGuardians(
    schoolId: string,
    studentId: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    return this.prisma.studentGuardian.findMany({
      where: { studentId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async addGuardian(
    schoolId: string,
    studentId: string,
    dto: AddGuardianDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN_ESCOLAR) {
      throw new ForbiddenException('Apenas gestores podem vincular responsáveis.');
    }
    const guardianUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!guardianUser) throw new NotFoundException('Usuário não encontrado.');
    if (guardianUser.role !== 'PAIS_RESPONSAVEL') {
      throw new BadRequestException('O usuário deve ter o perfil PAIS_RESPONSAVEL.');
    }
    return this.prisma.studentGuardian.upsert({
      where: { studentId_userId: { studentId, userId: dto.userId } },
      create: {
        studentId,
        userId: dto.userId,
        relation: (dto.relation ?? 'RESPONSAVEL') as 'MAE' | 'PAI' | 'RESPONSAVEL' | 'OUTRO',
        isPrimary: dto.isPrimary ?? false,
      },
      update: {
        ...(dto.relation !== undefined && { relation: dto.relation }),
        ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async removeGuardian(
    schoolId: string,
    studentId: string,
    guardianUserId: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.ADMIN_ESCOLAR) {
      throw new ForbiddenException('Apenas gestores podem desvincular responsáveis.');
    }
    await this.prisma.studentGuardian.deleteMany({
      where: { studentId, userId: guardianUserId },
    });
    return { message: 'Vínculo removido.' };
  }
}
