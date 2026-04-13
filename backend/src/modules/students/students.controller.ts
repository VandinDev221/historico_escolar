import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AddGuardianDto } from './dto/add-guardian.dto';

@ApiTags('students')
@ApiBearerAuth()
@Controller('schools/:schoolId/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateStudentDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.studentsService.create(schoolId, dto, userSchoolId, userRole);
  }

  @Get()
  findAll(
    @Param('schoolId') schoolId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.studentsService.findAll(
      schoolId,
      userSchoolId,
      userRole,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.studentsService.findOne(id, userSchoolId, userRole);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.studentsService.update(id, dto, userSchoolId, userRole);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.studentsService.remove(id, userSchoolId, userRole);
  }

  @Get(':id/guardians')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  listGuardians(
    @Param('schoolId') schoolId: string,
    @Param('id') studentId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.studentsService.listGuardians(schoolId, studentId, userSchoolId, userRole);
  }

  @Post(':id/guardians')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  addGuardian(
    @Param('schoolId') schoolId: string,
    @Param('id') studentId: string,
    @Body() dto: AddGuardianDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.studentsService.addGuardian(schoolId, studentId, dto, userSchoolId, userRole);
  }

  @Delete(':id/guardians/:guardianUserId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  removeGuardian(
    @Param('schoolId') schoolId: string,
    @Param('id') studentId: string,
    @Param('guardianUserId') guardianUserId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.studentsService.removeGuardian(schoolId, studentId, guardianUserId, userSchoolId, userRole);
  }
}
