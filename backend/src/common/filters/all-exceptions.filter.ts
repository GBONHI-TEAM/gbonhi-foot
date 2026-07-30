import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

/**
 * Filtre global : évite qu'une erreur non-HTTP (ex. erreur Prisma) ne
 * remonte en 503 opaque. Renvoie un JSON lisible + log serveur.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown = 'Erreur interne du serveur';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as { message?: unknown }).message ?? res;
      error = exception.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
      // Code d'erreur Prisma éventuel (ex. P2002, P2025…)
      const code = (exception as { code?: string }).code;
      if (code) error = `${error} (${code})`;
    }

    this.logger.error(
      `${request?.method} ${request?.url} → ${status} : ${error} — ${JSON.stringify(message)}`,
    );

    reply.status(status).send({
      statusCode: status,
      error,
      message,
      path: request?.url,
    });
  }
}
