import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpsertYearConfigDto } from './dto/upsert-year-config.dto';
import { UpsertPromotionRuleDto } from './dto/upsert-promotion-rule.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSchoolDto) {
    if (dto.code) {
      const existing = await this.prisma.school.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException('Já existe uma escola com este código INEP.');
      }
    }
    return this.prisma.school.create({
      data: {
        municipalityId: dto.municipalityId,
        name: dto.name,
        code: dto.code || null,
        address: dto.address || null,
      },
      include: { municipality: true },
    });
  }

  async findAll() {
    return this.prisma.school.findMany({
      include: { municipality: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.school.findUnique({
      where: { id },
      include: { municipality: true },
    });
  }

  async findByUserSchool(schoolId: string | null) {
    if (!schoolId) return this.findAll();
    const school = await this.findById(schoolId);
    return school ? [school] : [];
  }

  async getYearConfig(schoolId: string, year: number, userSchoolId: string | null, userRole: UserRole) {
    if (userRole !== 'SUPER_ADMIN' && userSchoolId !== schoolId) {
      throw new ForbiddenException('Acesso negado.');
    }
    const config = await this.prisma.schoolYearConfig.findUnique({
      where: { schoolId_year: { schoolId, year } },
    });
    return config ?? { schoolId, year, daysLetivos: 200, cargaHorariaAnual: 800 };
  }

  async upsertYearConfig(
    schoolId: string,
    year: number,
    dto: UpsertYearConfigDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN_ESCOLAR') {
      throw new ForbiddenException('Apenas o gestor pode configurar ano letivo.');
    }
    if (userSchoolId !== schoolId && userRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Acesso negado a outra escola.');
    }
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escola não encontrada.');
    return this.prisma.schoolYearConfig.upsert({
      where: { schoolId_year: { schoolId, year } },
      create: {
        schoolId,
        year,
        daysLetivos: dto.daysLetivos ?? 200,
        cargaHorariaAnual: dto.cargaHorariaAnual ?? 800,
      },
      update: {
        ...(dto.daysLetivos !== undefined && { daysLetivos: dto.daysLetivos }),
        ...(dto.cargaHorariaAnual !== undefined && { cargaHorariaAnual: dto.cargaHorariaAnual }),
      },
    });
  }

  /** Regras de promoção/retenção: obtém regra para escola e ano (ou padrão se year null). */
  async getPromotionRule(schoolId: string, year: number | null, userSchoolId: string | null, userRole: UserRole) {
    if (userRole !== 'SUPER_ADMIN' && userSchoolId !== schoolId) throw new ForbiddenException('Acesso negado.');
    if (year != null) {
      const forYear = await this.prisma.promotionRule.findFirst({
        where: { schoolId, year },
      });
      if (forYear) return forYear;
    }
    const defaultRule = await this.prisma.promotionRule.findFirst({
      where: { schoolId, year: null },
    });
    if (defaultRule) return defaultRule;
    return {
      schoolId,
      year: year ?? null,
      minScore: 6,
      minFrequencyPercent: 75,
      useRecoveryScore: true,
    };
  }

  async upsertPromotionRule(
    schoolId: string,
    year: number | null,
    dto: UpsertPromotionRuleDto,
    userSchoolId: string | null,
    userRole: UserRole,
  ) {
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN_ESCOLAR') throw new ForbiddenException('Apenas gestores podem alterar regras.');
    if (userSchoolId !== schoolId && userRole !== 'SUPER_ADMIN') throw new ForbiddenException('Acesso negado.');
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escola não encontrada.');
    const yearVal = dto.year !== undefined ? dto.year : year;
    const data = {
      minScore: dto.minScore ?? 6,
      minFrequencyPercent: dto.minFrequencyPercent ?? 75,
      useRecoveryScore: dto.useRecoveryScore ?? true,
    };
    if (yearVal != null) {
      return this.prisma.promotionRule.upsert({
        where: { schoolId_year: { schoolId, year: yearVal } },
        create: { schoolId, year: yearVal, ...data },
        update: data,
      });
    }
    const existing = await this.prisma.promotionRule.findFirst({ where: { schoolId, year: null } });
    if (existing) {
      return this.prisma.promotionRule.update({ where: { id: existing.id }, data });
    }
    return this.prisma.promotionRule.create({ data: { schoolId, year: null, ...data } });
  }
}
