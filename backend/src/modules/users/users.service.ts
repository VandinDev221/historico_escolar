import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        active: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        teacherDisciplines: {
          select: {
            id: true,
            code: true,
            gradeConfigId: true,
            gradeConfig: { select: { id: true, subject: true, series: true } },
          },
        },
      },
    });
    return user;
  }

  async findAllBySchool(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        active: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        teacherDisciplines: {
          select: { code: true, gradeConfigId: true, gradeConfig: { select: { id: true, subject: true, series: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const schoolId = dto.role === 'SUPER_ADMIN' ? null : dto.schoolId ?? null;
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name.trim(),
        role: dto.role,
        schoolId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        active: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
      },
    });
    if (dto.role === 'PROFESSOR' && schoolId && dto.gradeConfigIds?.length) {
      await this.setTeacherDisciplines(user.id, schoolId, dto.gradeConfigIds);
    }
    return user;
  }

  /** Gera código alfanumérico único (8 caracteres) para vínculo professor-disciplina */
  private async generateTeacherDisciplineCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      const existing = await this.prisma.teacherDiscipline.findUnique({ where: { code } });
      if (!existing) return code;
    }
    return `TD${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  private async setTeacherDisciplines(userId: string, schoolId: string, gradeConfigIds: string[]) {
    const configs = await this.prisma.gradeConfig.findMany({
      where: { id: { in: gradeConfigIds }, schoolId },
      select: { id: true },
    });
    const validIds = configs.map((c) => c.id);
    await this.prisma.teacherDiscipline.deleteMany({ where: { userId } });
    for (const gradeConfigId of validIds) {
      const code = await this.generateTeacherDisciplineCode();
      await this.prisma.teacherDiscipline.create({
        data: { userId, gradeConfigId, code },
      });
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }
    }
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.role !== undefined) data.role = dto.role;
    const effectiveRole = dto.role ?? user.role;
    if (dto.schoolId !== undefined) data.schoolId = effectiveRole === 'SUPER_ADMIN' ? null : dto.schoolId;
    if (dto.role === 'SUPER_ADMIN') data.schoolId = null;
    if (dto.active !== undefined) data.active = dto.active;
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        active: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
      },
    });
    if (dto.gradeConfigIds !== undefined && (effectiveRole === 'PROFESSOR' || user.role === 'PROFESSOR')) {
      const sid = updated.schoolId ?? user.schoolId;
      if (sid) {
        await this.setTeacherDisciplines(id, sid, dto.gradeConfigIds ?? []);
      } else {
        await this.prisma.teacherDiscipline.deleteMany({ where: { userId: id } });
      }
    }
    return updated;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário removido com sucesso.' };
  }

  /** Atualiza dados e/ou senha do próprio usuário */
  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (dto.password !== undefined) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Informe a senha atual para alterar a senha.');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) throw new BadRequestException('Senha atual incorreta.');
    }

    const data: Prisma.UserUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, 10);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        active: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        teacherDisciplines: {
          select: {
            id: true,
            code: true,
            gradeConfigId: true,
            gradeConfig: { select: { id: true, subject: true, series: true } },
          },
        },
      },
    });
    return updated;
  }

  /** Professor adiciona uma disciplina (da sua escola); gera código vinculado */
  async addMyDiscipline(userId: string, gradeConfigId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, schoolId: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.role !== 'PROFESSOR') {
      throw new ForbiddenException('Apenas professores podem cadastrar disciplinas.');
    }
    if (!user.schoolId) {
      throw new BadRequestException('Professor sem escola vinculada.');
    }

    const gradeConfig = await this.prisma.gradeConfig.findFirst({
      where: { id: gradeConfigId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!gradeConfig) {
      throw new BadRequestException('Disciplina não encontrada ou não pertence à sua escola.');
    }

    const existing = await this.prisma.teacherDiscipline.findUnique({
      where: { userId_gradeConfigId: { userId, gradeConfigId } },
    });
    if (existing) {
      throw new ConflictException('Você já está vinculado a esta disciplina.');
    }

    const code = await this.generateTeacherDisciplineCode();
    const td = await this.prisma.teacherDiscipline.create({
      data: { userId, gradeConfigId, code },
      select: {
        id: true,
        code: true,
        gradeConfigId: true,
        gradeConfig: { select: { id: true, subject: true, series: true } },
      },
    });
    return td;
  }

  /** Professor remove vínculo com uma disciplina */
  async removeMyDiscipline(userId: string, gradeConfigId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.role !== 'PROFESSOR') {
      throw new ForbiddenException('Apenas professores podem remover disciplinas.');
    }

    const deleted = await this.prisma.teacherDiscipline.deleteMany({
      where: { userId, gradeConfigId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Vínculo com esta disciplina não encontrado.');
    }
    return { message: 'Disciplina removida do seu perfil.' };
  }

  /** Portal do responsável: lista alunos vinculados ao usuário (PAIS_RESPONSAVEL) */
  async getMyGuardianStudents(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || user.role !== 'PAIS_RESPONSAVEL') {
      return [];
    }
    const links = await this.prisma.studentGuardian.findMany({
      where: { userId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            birthDate: true,
            schoolId: true,
            school: { select: { id: true, name: true } },
          },
        },
      },
    });
    const students = links.map((l) => l.student);
    interface StudentRow { id: string; name: string; birthDate: Date; schoolId: string; school: { id: string; name: string } }
    const withEnrollments = await Promise.all(
      (students as StudentRow[]).map(async (s) => {
        const enrollments = await this.prisma.enrollment.findMany({
          where: { studentId: s.id },
          select: { id: true, year: true, series: true, situation: true },
          orderBy: { year: 'desc' },
        });
        return { ...s, enrollments };
      }),
    );
    return withEnrollments;
  }
}
