import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';

export interface SearchSchoolResult {
  id: string;
  name: string;
  code: string | null;
  municipality: { name: string; state: string };
}

export interface SearchStudentResult {
  id: string;
  name: string;
  schoolId: string;
  school: { name: string };
}

export interface GlobalSearchResult {
  schools: SearchSchoolResult[];
  students: SearchStudentResult[];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(
    q: string,
    userSchoolId: string | null,
    userRole: UserRole,
  ): Promise<GlobalSearchResult> {
    const term = (q || '').trim();
    if (term.length < 2) {
      return { schools: [], students: [] };
    }

    // Usuário não-SUPER_ADMIN sem escola vinculada não vê resultados
    if (userRole !== UserRole.SUPER_ADMIN && !userSchoolId) {
      return { schools: [], students: [] };
    }

    const schoolWhere =
      userRole === UserRole.SUPER_ADMIN
        ? {}
        : { id: userSchoolId! };
    const studentSchoolFilter =
      userRole === UserRole.SUPER_ADMIN ? {} : { schoolId: userSchoolId! };

    const [schools, students] = await Promise.all([
      this.prisma.school.findMany({
        where: {
          ...schoolWhere,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            ...(term.match(/^\d+$/) ? [{ code: { contains: term } }] : []),
          ],
        },
        include: { municipality: true },
        take: 10,
        orderBy: { name: 'asc' },
      }),
      this.prisma.student.findMany({
        where: {
          ...studentSchoolFilter,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            ...(term.match(/^[\d.\-]+$/) ? [{ cpf: { contains: term } }] : []),
          ],
        },
        include: { school: { select: { name: true } } },
        take: 15,
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        municipality: s.municipality,
      })),
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        schoolId: s.schoolId,
        school: { name: s.school.name },
      })),
    };
  }
}
