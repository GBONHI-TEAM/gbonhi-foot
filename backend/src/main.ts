import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Cast needed: NestFastifyApplication.enableCors uses FastifyCorsOptions
  // which is structurally incompatible with INestApplication's CorsOptions (Express type)
  // FastifyAdapter.enableCors uses FastifyCorsOptions vs AbstractHttpAdapter's Express CorsOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = (await NestFactory.create(
    AppModule,
    new FastifyAdapter({ logger: true }) as any,
  )) as NestFastifyApplication;

  // Filtre global d'exceptions (JSON lisible au lieu de 503 opaque)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS — allow mobile app and web portals.
  // Méthodes explicites : sans ça, PATCH/DELETE peuvent être refusés au préflight.
  app.enableCors({
    origin: [
      process.env.ADMIN_URL ?? 'http://localhost:3000',
      process.env.PARTNER_URL ?? 'http://localhost:3002',
      'http://localhost:3000',
      'http://localhost:3002',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // En-têtes de sécurité (équivalent helmet, sans dépendance). La CSP autorise
  // explicitement ce que les pages HTML servies par l'API utilisent (styles/JS
  // inline, images même-origine + Supabase Storage + data:) afin de NE PAS
  // casser les smart links (/join, /r/*, /p/*) ni les reçus/brand.
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', (_req: unknown, reply: { header: (k: string, v: string) => void }, payload: unknown, done: (err: Error | null, p?: unknown) => void) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; base-uri 'self'; frame-ancestors 'self'; object-src 'none'",
    );
    done(null, payload);
  });

  // API prefix. Les smart links HTTPS restent hors API pour être cliquables dans
  // WhatsApp/SMS et ouvrir l'app sur le contenu correspondant.
  app.setGlobalPrefix('api/v1', { exclude: ['/', 'join', 'r/*', 'brand/*', 'p/*'] });

  // Swagger — only in non-production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Gbonhi Foot API')
      .setDescription('API pour la plateforme Gbonhi Foot')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const document = SwaggerModule.createDocument(app as any, config);
    SwaggerModule.setup('docs', app as any, document);
    logger.log('Swagger disponible sur /docs');
  }

  const port = process.env.PORT ?? 8000;
  await app.listen(port, '0.0.0.0');
  logger.log(`API démarrée sur le port ${port}`);
}

bootstrap();
