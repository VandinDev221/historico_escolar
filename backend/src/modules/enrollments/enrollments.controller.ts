import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@ApiTags('enrollments')
@ApiBearerAuth()
@Controller('schools/:schoolId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('students/:studentId/enrollments')
  create(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Body() dto: CreateEnrollmentDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.enrollmentsService.create(schoolId, studentId, dto, userSchoolId, userRole);
  }

  @Get('enrollments')
  findBySchool(
    @Param('schoolId') schoolId: string,
    @Query('year') year: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.enrollmentsService.findBySchool(
      schoolId,
      parseInt(year, 10) || new Date().getFullYear(),
      userSchoolId,
      userRole,
    );
  }

  @Get('students/:studentId/enrollments')
  findByStudent(
    @Param('studentId') studentId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.enrollmentsService.findByStudent(studentId, userSchoolId, userRole);
  }

  @Patch('students/:studentId/enrollments/:enrollmentId')
  update(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: Partial<CreateEnrollmentDto> & { turmaId?: string | null },
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.enrollmentsService.update(schoolId, studentId, enrollmentId, dto, userSchoolId, userRole);
  }
}
