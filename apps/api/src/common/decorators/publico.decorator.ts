import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

/** Marca un endpoint que no requiere sesión. Todo lo demás exige sesión (401 si no hay). */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
