import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard(
    @Query('schoolId') schoolId: string,
    @Query('year') year: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.reportsService.getDashboard(schoolId, y, userSchoolId, userRole);
  }

  @Get('export')
  getExport(
    @Query('schoolId') schoolId: string,
    @Query('year') year: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.reportsService.getExportData(
      schoolId,
      y,
      userSchoolId,
      userRole,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 500,
    );
  }

  @Get('alerts')
  getAlerts(
    @Query('schoolId') schoolId: string,
    @Query('year') year: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.reportsService.getAlerts(schoolId, y, userSchoolId, userRole);
  }

  @Post('enrollments/:enrollmentId/notify-conselho-tutelar')
  notifyConselhoTutelar(
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.reportsService.notifyConselhoTutelar(enrollmentId, userId, userSchoolId, userRole);
  }

  @Get('recovery')
  getRecovery(
    @Query('schoolId') schoolId: string,
    @Query('year') year: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.reportsService.getRecovery(schoolId, y, userSchoolId, userRole);
  }

  @Get('diary')
  getClassDiary(
    @Query('schoolId') schoolId: string,
    @Query('turmaId') turmaId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.reportsService.getClassDiaryReport(
      schoolId,
      turmaId,
      startDate,
      endDate,
      userSchoolId,
      userRole,
    );
  }

  @Get('boletim/:enrollmentId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR, UserRole.PAIS_RESPONSAVEL)
  getBoletim(
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('id') userId: string,
  ) {
    return this.reportsService.getBoletim(enrollmentId, userSchoolId, userRole, userId);
  }
}
