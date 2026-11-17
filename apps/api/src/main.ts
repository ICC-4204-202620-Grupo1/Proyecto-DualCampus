import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './app.setup.js';

// En desarrollo carga apps/api/.env si existe; en Vercel las variables vienen del proyecto
try {
  // Funciona tanto al ejecutar desde la raiz como desde apps/api.
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch {
  /* sin archivo .env */
}

async function bootstrap() {
  const app = configurarApp(await NestFactory.create<NestExpressApplication>(AppModule));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
