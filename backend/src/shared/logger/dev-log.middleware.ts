import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DevLoggerService } from './dev-logger.service';
import { DevBlocklistService } from '../../modules/dev/dev-blocklist.service';
import { detectSuspicious } from './suspicious-detector';

@Injectable()
export class DevLogMiddleware implements NestMiddleware {
  constructor(
    private readonly devLogger: DevLoggerService,
    private readonly blocklist: DevBlocklistService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const ip = (req as Request & { ip?: string }).ip ?? req.socket?.remoteAddress ?? '';
    const path = (req.originalUrl || req.url).split('?')[0];

    // Rotas de gestão da blocklist: sempre permitir para o próprio IP poder se desbloquear
    const isBlocklistManagement = path.includes('dev/blocklist') || path.includes('dev/block-ip');
    if (!isBlocklistManagement && this.blocklist.has(ip)) {
      this.devLogger.http({
        method: req.method,
        path,
        statusCode: 403,
        durationMs: Date.now() - start,
        ip,
        suspiciousReason: 'IP bloqueado pelo painel dev',
      });
      res.status(403).json({ statusCode: 403, message: 'IP bloqueado.' });
      return;
    }

    const suspicious = detectSuspicious(req.method, path);

    if (suspicious) {
      const durationMs = Date.now() - start;
      this.devLogger.http({
        method: req.method,
        path,
        statusCode: 403,
        durationMs,
        ip,
        suspiciousCategory: suspicious.category,
        suspiciousReason: suspicious.reason,
      });
      res.status(403).json({
        statusCode: 403,
        message: 'Acesso suspeito registrado.',
      });
      return;
    }

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const userId = (req as Request & { user?: { id?: string } }).user?.id;
      this.devLogger.http({
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs,
        ip,
        userId,
      });
    });

    next();
  }
}
