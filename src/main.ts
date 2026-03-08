import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function parseCorsOrigins(raw?: string): string[] | null {
  if (!raw) return null;
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return origins.length ? origins : null;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // -------------------------
  // Global Validation (DTOs)
  // -------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // -------------------------
  // Security headers
  // -------------------------
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // -------------------------
  // CORS
  // -------------------------
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!allowedOrigins) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // -------------------------
  // Swagger (API docs)
  // -------------------------
  const swaggerEnabled =
    (process.env.SWAGGER_ENABLED ?? 'true').toLowerCase() !== 'false';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Valises Backend API')
      .setDescription('API documentation (V1)')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          in: 'header',
        },
        'bearer',
      )
      // ✅ force swagger-ui to use this bearer scheme
      .addSecurityRequirements('bearer')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
  if (swaggerEnabled) {
    // eslint-disable-next-line no-console
    console.log(`Swagger: http://localhost:${port}/docs`);
  }
}

bootstrap();