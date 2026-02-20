import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Activation globale du filtre Prisma
  app.useGlobalFilters(new PrismaExceptionFilter());

  await app.listen(3000);
}
bootstrap();
