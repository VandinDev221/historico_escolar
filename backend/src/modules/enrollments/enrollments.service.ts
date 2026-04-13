import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { SituacaoMatricula } from '@prisma/client';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureSchoolAccess(schoolId: string, userSchoolId: string | null, userRole: UserRole) {
    if (userRole === UserRole.SUPER_ADMIN) return;
    if (userSchoolId !== schoolId) throw new ForbiddenException('Acesso negado a dados de outra escola.');
  }

  async create(
    schoolId: string,
    studentId: string,
    dto: CreateEnrollmentDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado nesta escola.');
    const situation = (dto.situation ?? 'CURSANDO') as SituacaoMatricula;

    // Regra de negócio: só pode haver uma matrícula por aluno/ano.
    // Se já existir, bloqueia e orienta a editar a matrícula existente.
    const existing = await this.prisma.enrollment.findFirst({
      where: { studentId, year: dto.year },
    });

    if (existing) {
      throw new BadRequestException('Aluno(a) já matriculado neste ano. Edite a matrícula existente para alterar turma ou situação.');
    }

    return this.prisma.enrollment.create({
      data: {
        studentId,
        schoolId,
        year: dto.year,
        series: dto.series,
        situation,
        ...(dto.turmaId && { turmaId: dto.turmaId }),
      },
      include: { student: true, turma: true },
    });
  }

  async findByStudent(studentId: string, userSchoolId: string | null, userRole: UserRole) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: { school: true, grades: { include: { gradeConfig: true } } },
      orderBy: { year: 'desc' },
    });
    if (enrollments.length && enrollments[0].schoolId !== userSchoolId && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Acesso negado.');
    }
    return enrollments;
  }

  async findBySchool(schoolId: string, year: number, userSchoolId: string | null, userRole: UserRole) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    return this.prisma.enrollment.findMany({
      where: { schoolId, year },
      include: { student: true },
      orderBy: { student: { name: 'asc' } },
    });
  }

  async update(
    schoolId: string,
    studentId: string,
    enrollmentId: string,
    dto: Partial<CreateEnrollmentDto> & { turmaId?: string | null },
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    this.ensureSchoolAccess(schoolId, userSchoolId, userRole);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, studentId, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada para este aluno/escola.');

    const situation = (dto.situation ?? enrollment.situation) as SituacaoMatricula;

    return this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        ...(dto.series !== undefined && { series: dto.series }),
        situation,
        ...(dto.turmaId !== undefined && { turmaId: dto.turmaId }),
      },
      include: { student: true, turma: true },
    });
  }
}
