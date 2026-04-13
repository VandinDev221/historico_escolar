import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { StudentDocumentsService } from './student-documents.service';
import { CreateStudentDocumentDto } from './dto/create-student-document.dto';

@ApiTags('student-documents')
@ApiBearerAuth()
@Controller('schools/:schoolId/students/:studentId/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
export class StudentDocumentsController {
  constructor(private readonly service: StudentDocumentsService) {}

  @Get()
  listByStudent(
    @Param('studentId') studentId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.listByStudent(studentId, userSchoolId, userRole);
  }

  @Post()
  create(
    @Param('studentId') studentId: string,
    @Body() dto: CreateStudentDocumentDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.create(studentId, dto, userSchoolId, userRole);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.remove(id, userSchoolId, userRole);
  }
}
