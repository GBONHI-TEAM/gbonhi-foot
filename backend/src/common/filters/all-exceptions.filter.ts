import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

type HttpResponsePayload = {
  message?: string | string[];
  code?: string;
};

type ErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  requestId?: string;
};

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
    const request = ctx.getRequest<{ id?: string; method?: string; url?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Une erreur inattendue est survenue. Réessaie dans quelques instants.';
    let code = 'INTERNAL_ERROR';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const payload = typeof res === 'string' ? { message: res } : (res as HttpResponsePayload);
      const responseMessage = payload.message;
      if (Array.isArray(responseMessage)) {
        details = responseMessage;
        message = 'Certains champs sont invalides. Vérifie les champs indiqués.';
      } else if (typeof responseMessage === 'string') {
        message = responseMessage;
      }
      code = payload.code ?? this.codeForHttpStatus(status);
    } else if (exception instanceof Error) {
      // Les détails techniques restent strictement dans les logs backend.
      const prismaCode = (exception as { code?: string }).code;
      if (prismaCode === 'P1001' || prismaCode === 'P1017') {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        code = 'SERVICE_UNAVAILABLE';
        message = 'La base de données est momentanément inaccessible. Réessaie dans quelques secondes.';
      } else if (prismaCode === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'RESOURCE_ALREADY_EXISTS';
        message = 'Cette information existe déjà. Vérifie les données saisies.';
      } else if (prismaCode === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RESOURCE_NOT_FOUND';
        message = 'La ressource demandée est introuvable ou n’est plus disponible.';
      }
    }

    this.logger.error(
      `${request?.method} ${request?.url} → ${status} [${code}] requestId=${request?.id ?? 'n/a'}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    const response: ErrorResponse = {
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
      ...(request?.id ? { requestId: request.id } : {}),
    };

    reply.status(status).send(response);
  }

  private codeForHttpStatus(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return 'REQUEST_INVALID';
    if (status === HttpStatus.UNAUTHORIZED) return 'AUTHENTICATION_REQUIRED';
    if (status === HttpStatus.FORBIDDEN) return 'ACCESS_DENIED';
    if (status === HttpStatus.NOT_FOUND) return 'RESOURCE_NOT_FOUND';
    if (status === HttpStatus.CONFLICT) return 'CONFLICT';
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
    return 'REQUEST_FAILED';
  }
}
