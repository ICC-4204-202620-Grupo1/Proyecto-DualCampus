import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarApp } from './app.setup';

// En desarrollo carga apps/api/.env si existe; en Vercel las variables vienen del proyecto
try {
  process.loadEnvFile('.env');
} catch {
  /* sin archivo .env */
}

async function bootstrap() {
  const app = configurarApp(await NestFactory.create<NestExpressApplication>(AppModule));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
