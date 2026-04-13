import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { GradesService } from './grades.service';
import { UpsertGradeDto } from './dto/upsert-grade.dto';
import { UpsertGradesBulkDto } from './dto/upsert-grades-bulk.dto';
import { CreateGradeConfigDto } from './dto/create-grade-config.dto';
import { UpdateGradeConfigDto } from './dto/update-grade-config.dto';

@ApiTags('grades')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post('enrollments/:enrollmentId/grades/:gradeConfigId')
  upsert(
    @Param('enrollmentId') enrollmentId: string,
    @Param('gradeConfigId') gradeConfigId: string,
    @Body() dto: UpsertGradeDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.gradesService.upsert(
      enrollmentId,
      gradeConfigId,
      dto,
      userSchoolId,
      userRole,
      userId,
    );
  }

  @Get('schools/:schoolId/turmas/:turmaId/grades-bulk')
  getBulkByTurma(
    @Param('schoolId') schoolId: string,
    @Param('turmaId') turmaId: string,
    @Query('gradeConfigId') gradeConfigId: string,
    @Query('bimester') bimester: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    if (!gradeConfigId?.trim()) return [];
    const bim = bimester ? parseInt(bimester, 10) : 1;
    if (Number.isNaN(bim) || bim < 1 || bim > 4) {
      return [];
    }
    return this.gradesService.getBulkByTurma(
      schoolId,
      turmaId,
      gradeConfigId,
      bim,
      userSchoolId,
      userRole,
      userId,
    );
  }

  @Post('schools/:schoolId/turmas/:turmaId/grades-bulk')
  upsertBulk(
    @Param('schoolId') schoolId: string,
    @Param('turmaId') turmaId: string,
    @Body() dto: UpsertGradesBulkDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.gradesService.upsertBulk(schoolId, turmaId, dto, userSchoolId, userRole, userId);
  }

  @Get('enrollments/:enrollmentId/grades')
  findByEnrollment(
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.gradesService.findByEnrollment(
      enrollmentId,
      userSchoolId,
      userRole,
      userId,
    );
  }

  @Get('schools/:schoolId/grade-configs')
  getGradeConfigs(
    @Param('schoolId') schoolId: string,
    @Query('series') series: string | undefined,
    @CurrentUser('id') userId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    if (series) {
      return this.gradesService.getGradeConfigs(
        schoolId,
        series,
        userSchoolId,
        userRole,
        userId,
      );
    }
    return this.gradesService.getGradeConfigsBySchool(schoolId, userSchoolId, userRole);
  }

  @Post('schools/:schoolId/grade-configs')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  createGradeConfig(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateGradeConfigDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.gradesService.createGradeConfig(schoolId, dto, userSchoolId, userRole);
  }

  @Patch('schools/:schoolId/grade-configs/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  updateGradeConfig(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGradeConfigDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.gradesService.updateGradeConfig(schoolId, id, dto, userSchoolId, userRole);
  }

  @Delete('schools/:schoolId/grade-configs/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  deleteGradeConfig(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.gradesService.deleteGradeConfig(schoolId, id, userSchoolId, userRole);
  }
}
