// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // CORS
  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? '';
  if (corsOrigin.trim().length > 0) {
    // Support multiple origins separated by commas
    const origins = corsOrigin.split(',').map((s) => s.trim());
    app.enableCors({
      origin: origins,
      credentials: true,
    });
  } else {
    // Dev default: allow all (tu pourras durcir plus tard)
    app.enableCors({
      origin: true,
      credentials: true,
    });
  }

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // supprime les champs inconnus
      forbidNonWhitelisted: true,   // rejette si champ inconnu présent
      transform: true,              // transforme en types DTO (string->number etc)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Prisma errors -> HTTP
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();