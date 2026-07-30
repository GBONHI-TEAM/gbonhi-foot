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

  // API prefix (on exclut la racine `/` pour la route d'accueil / sondes hébergeur)
  app.setGlobalPrefix('api/v1', { exclude: ['/'] });

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
