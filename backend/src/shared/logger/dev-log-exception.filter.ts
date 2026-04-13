import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DevLoggerService } from './dev-logger.service';

@Catch()
export class DevLogExceptionFilter implements ExceptionFilter {
  constructor(private readonly devLogger: DevLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : 'Erro desconhecido';

    // 401/403 são esperados (rota protegida sem token ou sem permissão) — não poluir console como ERROR
    const isAuthFailure = status === 401 || status === 403;
    const level = isAuthFailure ? 'warn' : 'error';
    this.devLogger.log(level, message, {
      path: req.url,
      method: req.method,
      statusCode: status,
      extra: isAuthFailure ? undefined : (exception instanceof Error ? { stack: exception.stack } : undefined),
    });
    if (!isAuthFailure) Logger.error(exception);

    res.status(status).json(
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message },
    );
  }
}
