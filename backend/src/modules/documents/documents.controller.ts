import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { DocumentsService } from './documents.service';
import { GenerateDeclarationDto } from './dto/generate-declaration.dto';
import { GenerateHistoricoDto } from './dto/generate-historico.dto';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('schools/:schoolId/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  @ApiBearerAuth()
  generate(
    @Param('schoolId') schoolId: string,
    @Body() dto: GenerateDeclarationDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.documentsService.generate(schoolId, dto, userSchoolId, userRole);
  }

  @Post('schools/:schoolId/historico-escolar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  @ApiBearerAuth()
  generateHistoricoEscolar(
    @Param('schoolId') schoolId: string,
    @Body() dto: GenerateHistoricoDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.documentsService.generateHistoricoEscolar(schoolId, dto.studentId, userSchoolId, userRole);
  }

  @Get('schools/:schoolId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
  @ApiBearerAuth()
  listBySchool(
    @Param('schoolId') schoolId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.documentsService.listBySchool(
      schoolId,
      userSchoolId,
      userRole,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('students/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR, UserRole.PAIS_RESPONSAVEL)
  @ApiBearerAuth()
  listByStudent(
    @Param('studentId') studentId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.listByStudent(studentId, userSchoolId, userRole, userId);
  }

  @Get('validate/:code')
  validateByCode(@Param('code') code: string) {
    return this.documentsService.validateByCode(code);
  }

  @Get('pdf/:code')
  async getPdf(@Param('code') code: string, @Res() res: Response) {
    const { buffer, filename } = await this.documentsService.getPdfByCode(code);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
