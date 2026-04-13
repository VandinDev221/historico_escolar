import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { StudentDocumentType } from '@prisma/client';
import { CreateStudentDocumentDto } from './dto/create-student-document.dto';

@Injectable()
export class StudentDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureSchoolAccess(schoolId: string, userSchoolId: string | null, userRole: UserRole) {
    if (userRole === UserRole.SUPER_ADMIN) return;
    if (userSchoolId !== schoolId) throw new ForbiddenException('Acesso negado a dados de outra escola.');
  }

  async listByStudent(
    studentId: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    this.ensureSchoolAccess(student.schoolId, userSchoolId, userRole);
    return this.prisma.studentDocument.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    studentId: string,
    dto: CreateStudentDocumentDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Aluno não encontrado.');
    this.ensureSchoolAccess(student.schoolId, userSchoolId, userRole);
    return this.prisma.studentDocument.create({
      data: {
        studentId,
        type: dto.type as StudentDocumentType,
        name: dto.name,
        filePath: dto.filePath,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
    });
  }

  async remove(
    id: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    const doc = await this.prisma.studentDocument.findUnique({
      where: { id },
      include: { student: true },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    this.ensureSchoolAccess(doc.student.schoolId, userSchoolId, userRole);
    await this.prisma.studentDocument.delete({ where: { id } });
    return { message: 'Documento removido.' };
  }
}
