import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/** Configuración común de la app (se usa en main.ts y en las pruebas). */
export function configurarApp(app: NestExpressApplication) {
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  return app;
}
