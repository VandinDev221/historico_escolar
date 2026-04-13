import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { InepService } from './inep.service';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly inepService: InepService) {}

  @Get('inep/status')
  inepStatus() {
    return { configured: this.inepService.isConfigured() };
  }

  @Get('inep/school/:code')
  getSchoolByInep(@Param('code') code: string) {
    return this.inepService.getSchoolByInepCode(code);
  }
}
