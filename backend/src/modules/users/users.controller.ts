import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddDisciplineDto } from './dto/add-discipline.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  list() {
    return this.usersService.findAll();
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR, UserRole.PAIS_RESPONSAVEL)
  me(@CurrentUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Get('me/students')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PAIS_RESPONSAVEL)
  myGuardianStudents(@CurrentUser('id') userId: string) {
    return this.usersService.getMyGuardianStudents(userId);
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_ESCOLAR, UserRole.PROFESSOR, UserRole.PAIS_RESPONSAVEL)
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Post('me/disciplines')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PROFESSOR)
  addMyDiscipline(@CurrentUser('id') userId: string, @Body() dto: AddDisciplineDto) {
    return this.usersService.addMyDiscipline(userId, dto.gradeConfigId);
  }

  @Delete('me/disciplines/:gradeConfigId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PROFESSOR)
  removeMyDiscipline(@CurrentUser('id') userId: string, @Param('gradeConfigId') gradeConfigId: string) {
    return this.usersService.removeMyDiscipline(userId, gradeConfigId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
