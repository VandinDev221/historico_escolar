import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Bloqueia acesso às rotas de dev em produção.
 * Ative com DISABLE_DEV_ROUTES=true ou NODE_ENV=production.
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const isProd = process.env.NODE_ENV === 'production';
    const devDisabled = process.env.DISABLE_DEV_ROUTES === 'true';
    if (isProd || devDisabled) {
      throw new ForbiddenException('Rotas de desenvolvimento desativadas neste ambiente.');
    }
    return true;
  }
}
