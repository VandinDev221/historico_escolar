import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { TurmasService } from './turmas.service';
import { CreateTurmaDto } from './dto/create-turma.dto';
import { UpdateTurmaDto } from './dto/update-turma.dto';
import { UpsertDiaryDto } from './dto/upsert-diary.dto';
import { JustifyAbsenceDto } from './dto/justify-absence.dto';

@ApiTags('turmas')
@ApiBearerAuth()
@Controller('schools/:schoolId/turmas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
export class TurmasController {
  constructor(private readonly turmasService: TurmasService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateTurmaDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.turmasService.create(schoolId, dto, userSchoolId, userRole);
  }

  @Get()
  list(
    @Param('schoolId') schoolId: string,
    @Query('year') year: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.turmasService.findBySchool(schoolId, y, userSchoolId, userRole);
  }

  @Get(':turmaId')
  findOne(
    @Param('turmaId') turmaId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.turmasService.findOne(turmaId, userSchoolId, userRole);
  }

  @Patch(':turmaId/attendance-records/:recordId/justify')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  @UseInterceptors(FileInterceptor('atestadoImage'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        note: { type: 'string' },
        atestadoDocRef: { type: 'string' },
        atestadoImage: { type: 'string', format: 'binary', description: 'Imagem do atestado escaneado (opcional)' },
      },
    },
  })
  justifyAbsence(
    @Param('schoolId') schoolId: string,
    @Param('turmaId') turmaId: string,
    @Param('recordId') recordId: string,
    @Body() dto: JustifyAbsenceDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
    @UploadedFile() _file?: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    const file = _file
      ? {
          buffer: _file.buffer,
          mimetype: _file.mimetype,
          originalname: _file.originalname || '',
        }
      : undefined;
    return this.turmasService.justifyAbsence(schoolId, turmaId, recordId, userId, dto, userSchoolId, userRole, file);
  }

  @Patch(':turmaId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  update(
    @Param('turmaId') turmaId: string,
    @Body() dto: UpdateTurmaDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.turmasService.update(turmaId, dto, userSchoolId, userRole);
  }

  @Delete(':turmaId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR)
  remove(
    @Param('turmaId') turmaId: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.turmasService.remove(turmaId, userSchoolId, userRole);
  }

  @Get(':turmaId/attendance-records/:recordId/atestado-image')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR)
  async getAtestadoImage(
    @Param('schoolId') schoolId: string,
    @Param('turmaId') turmaId: string,
    @Param('recordId') recordId: string,
    @Res({ passthrough: false }) res: Response,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    const result = await this.turmasService.getAtestadoImagePath(recordId, schoolId, turmaId, userSchoolId, userRole);
    if (!result) {
      res.status(404).json({ message: 'Imagem do atestado não encontrada.' });
      return;
    }
    res.setHeader('Content-Type', result.mimetype);
    res.sendFile(result.fullPath);
  }

  @Get(':turmaId/diary')
  getDiary(
    @Param('schoolId') schoolId: string,
    @Param('turmaId') turmaId: string,
    @Query('date') date: string,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.turmasService.getDiary(turmaId, date || new Date().toISOString().slice(0, 10), userSchoolId, userRole);
  }

  @Post(':turmaId/diary')
  upsertDiary(
    @Param('schoolId') schoolId: string,
    @Param('turmaId') turmaId: string,
    @Body() dto: UpsertDiaryDto,
    @CurrentUser('schoolId') userSchoolId: string | null,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.turmasService.upsertDiary(turmaId, dto, userSchoolId, userRole);
  }
}
