import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compila los decoradores con su metadata, que NestJS necesita para la inyección
export default defineConfig({
  // Las suites HTTP son pequeñas: un worker evita contención al iniciar varias apps Nest.
  // Las pruebas de concurrencia dentro de una suite conservan sus peticiones simultáneas.
  test: { include: ['test/**/*.spec.ts'], environment: 'node', maxWorkers: 1 },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
