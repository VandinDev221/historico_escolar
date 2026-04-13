import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpsertYearConfigDto } from './dto/upsert-year-config.dto';
import { UpsertPromotionRuleDto } from './dto/upsert-promotion-rule.dto';

@ApiTags('schools')
@ApiBearerAuth()
@Controller('schools')
@UseGuards(JwtAuthGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
  list(@CurrentUser('schoolId') schoolId: string | null) {
    return this.schoolsService.findByUserSchool(schoolId);
  }

  @Get(':schoolId/promotion-rule')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
  getPromotionRule(
    @Param('schoolId') schoolId: string,
    @Query('year') year: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    const y = year ? parseInt(year, 10) : null;
    return this.schoolsService.getPromotionRule(schoolId, y, userSchoolId, userRole);
  }

  @Patch(':schoolId/promotion-rule')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  upsertPromotionRule(
    @Param('schoolId') schoolId: string,
    @Body() dto: UpsertPromotionRuleDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    const y = dto.year !== undefined ? dto.year : null;
    return this.schoolsService.upsertPromotionRule(schoolId, y, dto, userSchoolId, userRole);
  }

  @Get(':schoolId/year-config/:year')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
  getYearConfig(
    @Param('schoolId') schoolId: string,
    @Param('year', ParseIntPipe) year: number,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.schoolsService.getYearConfig(schoolId, year, userSchoolId, userRole);
  }

  @Patch(':schoolId/year-config/:year')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  upsertYearConfig(
    @Param('schoolId') schoolId: string,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: UpsertYearConfigDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.schoolsService.upsertYearConfig(schoolId, year, dto, userSchoolId, userRole);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
  findOne(@Param('id') id: string) {
    return this.schoolsService.findById(id);
  }
}
