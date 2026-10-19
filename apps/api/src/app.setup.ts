import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import cookieParser from 'cookie-parser';

/** Configuración común de la app (se usa en main.ts y en las pruebas). */
export function configurarApp(app: NestExpressApplication) {
  app.set('trust proxy', 1);
  app.use(cookieParser());
  // Límite acotado para el documento de 1 MB codificado como base64.
  app.use('/api/materiales/secciones', json({ limit: '1500kb' }));
  // Nest detecta el parser anterior: registrar también el límite habitual para las demás rutas.
  app.use(json({ limit: '100kb' }));
  app.setGlobalPrefix('api');
  return app;
}
