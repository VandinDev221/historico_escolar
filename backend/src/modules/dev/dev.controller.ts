import { Body, Controller, Delete, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { DevOnlyGuard } from '../../shared/guards/dev-only.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DevLoggerService } from '../../shared/logger/dev-logger.service';
import { DevBlocklistService } from './dev-blocklist.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Rotas de desenvolvimento: logs em tempo real, blocklist de IPs.
 * Desativadas quando NODE_ENV=production ou DISABLE_DEV_ROUTES=true.
 * Acesso apenas SUPER_ADMIN (desenvolvedor).
 */
@Controller('dev')
@UseGuards(DevOnlyGuard, JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class DevController {
  constructor(
    private readonly devLogger: DevLoggerService,
    private readonly blocklist: DevBlocklistService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('logs')
  getLogs() {
    return this.devLogger.getRecent(500);
  }

  @Get('logs/stream')
  streamLogs(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const unsubscribe = this.devLogger.subscribe((entry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    res.on('close', () => unsubscribe());
  }

  @Get('logs/clear')
  clearLogs() {
    this.devLogger.clear();
    return { ok: true };
  }

  @Get('blocklist')
  getBlocklist() {
    return { ips: this.blocklist.list() };
  }

  @Post('block-ip')
  blockIp(@Body() body: { ip?: string }) {
    const ip = body?.ip?.trim();
    if (!ip) return { ok: false, message: 'ip é obrigatório' };
    this.blocklist.add(ip);
    return { ok: true, ips: this.blocklist.list() };
  }

  @Delete('block-ip/:ip')
  unblockIp(@Param('ip') ip: string) {
    this.blocklist.remove(ip || '');
    return { ok: true, ips: this.blocklist.list() };
  }

  /**
   * Cria alguns registros de turmas de exemplo para todas as escolas que ainda
   * não possuem turmas no ano atual (para facilitar testes do diário de classe).
   */
  @Post('seed-turmas')
  async seedTurmas() {
    const currentYear = new Date().getFullYear();
    const schools = await this.prisma.school.findMany({
      orderBy: { createdAt: 'asc' },
    });
    if (!schools.length) {
      return { ok: false, message: 'Nenhuma escola encontrada para criar turmas.' };
    }

    const created: unknown[] = [];

    for (const school of schools) {
      const existing = await this.prisma.turma.findMany({
        where: { schoolId: school.id, year: currentYear },
        take: 1,
      });
      if (existing.length > 0) continue;

      const turmas = await this.prisma.$transaction([
        this.prisma.turma.create({
          data: {
            schoolId: school.id,
            year: currentYear,
            series: '6º Ano',
            name: '6ºA',
            turno: 'MANHA',
          },
        }),
        this.prisma.turma.create({
          data: {
            schoolId: school.id,
            year: currentYear,
            series: '6º Ano',
            name: '6ºB',
            turno: 'INTEGRAL',
          },
        }),
        this.prisma.turma.create({
          data: {
            schoolId: school.id,
            year: currentYear,
            series: '9º Ano',
            name: '9ºA',
            turno: 'MANHA',
          },
        }),
      ]);

      created.push({ schoolId: school.id, turmas });
    }

    if (!created.length) {
      return { ok: true, message: 'Todas as escolas já possuem turmas neste ano.' };
    }

    return { ok: true, message: 'Turmas de exemplo criadas.', created };
  }
}
