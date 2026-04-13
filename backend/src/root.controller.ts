import { Controller, Get, Head, Res } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Rotas fora do prefixo global /api (excluídas em main.ts).
 * Evita 404/NotFound nos probes GET/HEAD / e /favicon.ico na Render.
 */
@Controller()
export class RootController {
  @Get()
  index() {
    return {
      service: 'historico-escolar-api',
      docs: '/api/docs',
      health: '/api/health',
    };
  }

  @Head()
  head(@Res() res: Response) {
    res.status(204).send();
  }

  @Get('favicon.ico')
  favicon(@Res() res: Response) {
    res.status(204).send();
  }
}
