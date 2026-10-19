# Flujo del equipo de DualCampus

Acuerdos vigentes comunicados por el equipo el 18-10-2026. Sustituyen la propuesta de la entrega 4.
Stack: React/TypeScript, NestJS y PostgreSQL; catálogo vigente: [56 historias](docs/tarjetas.md).

## Ramas y revisión

- main: versión estable. develop: integración.
- Crear feature/Hxx-descripcion desde develop actualizado.
- Abrir PR hacia develop con la plantilla del repositorio.
- Un compañero disponible distinto del autor revisa. No hay revisores preasignados ni cuotas.
- Resolver observaciones y ejecutar comprobaciones antes de integrar mediante merge commit.
- Promover develop a main mediante PR y validar producción.
- No usar force push ni reescribir main/develop.
- Los commits y el envío del PR de esta entrega los realiza Oscar, por instrucción expresa.

La rama preparatoria feature/entrega-5-iteracion-funcional conserva H02 y H05 desde
origin/feature/H05-crear-periodo. No significa que esas historias estén integradas en develop.
Antes del PR final, revisar los PR de base y sincronizar develop con los cambios aprobados,
sin perder los cambios locales. Véase [integración](docs/entrega-5/pr.md).

## Commits

Conventional Commits: tipo(ambito): descripción. Ejemplos:
feat(academico): configurar secciones y nóminas; test(academico): verificar aislamiento;
docs(entrega5): actualizar catálogo y evidencia. Cambios incompatibles usan ! y un pie BREAKING CHANGE.

## Definition of Ready

Historia y criterios claros, decisiones necesarias resueltas, dependencias terminadas o
mecanismo preparatorio explícitamente acordado y alcance verificable.
No se exige revisor preasignado ni cupo por columna/persona.
D5 está resuelta para el piloto; el resto de las decisiones continúa según [alcance](docs/entrega-5/alcance.md).

## Definition of Done

Criterios con evidencia, pruebas y compilación satisfactorias, revisión independiente resuelta,
integración en main, validación en producción/demostración, documentación actualizada y
tarjeta con PR, versión, evidencia, validador y fecha. Lo no aplicable se justifica.
Código local o pruebas verdes por sí solos no completan la historia.

## Comprobaciones

- npm ci
- npm run build (tipos y compilación de ambas aplicaciones)
- npm run test:api
- TEST_DATABASE_URL debe configurarse para incluir las pruebas PostgreSQL; sin ella se omiten explícitamente.
- npm run test:e2e (base de prueba y navegador, instrucciones en README)
- git diff --check

No existe configuración de lint en la base heredada; no declarar lint ejecutado.
No incorporar secretos ni datos académicos reales. Usar los datos sintéticos del piloto.
