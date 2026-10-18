# migrations

Scripts SQL de PostgreSQL 16, numerados en orden (001_..., 002_...). No se editan una vez
integrados: un cambio es una migración nueva. Se aplican con `npm run db:migrar`, que
registra cada archivo en la tabla `schema_migraciones`.
