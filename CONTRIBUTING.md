# Flujo propuesto del equipo

Propuesta pendiente de ratificación. La entrega 3 mantiene React y TypeScript,
NestJS y PostgreSQL. El código vive en apps/web (React) y apps/api (NestJS); ver README.

## Ramas

- main: versión estable y rama predeterminada.
- develop: integración.
- feature/H23-envio-informe: trabajo de una historia desde develop.
- fix/H23-validacion-archivo y docs/proceso: correcciones y documentación.
- hotfix/Hxx-descripcion: desde main, solo para una corrección urgente.

Los cambios se revisan mediante PR. El autor no es su propio revisor.
Una aprobación independiente, comentarios resueltos y comprobaciones aplicables
son requisitos de integración. Se usa Create a merge commit para conservar la
historia de integración. main y develop no se reescriben ni reciben force push.
No activar Require linear history si se elige este método.

La promoción usa PR de develop a main. Después de un hotfix a main, se integra
main en develop mediante PR antes de continuar las promociones. Un hotfix requiere
los mismos controles de revisión. No se declaran pruebas de CI ejecutadas si no
existe el workflow: definir comandos reales al crear la aplicación.

## Conventional Commits

Formato: tipo(ambito): descripcion. Ámbito opcional.
Ejemplos: feat(entregas): confirmar recepción de archivo
fix(auth): impedir acceso a otra institución
docs(proceso): actualizar políticas del tablero
test(notas): comprobar bloqueo de edición en revisión
Cambios incompatibles: feat(api)!: cambiar formato de calificaciones
Explicar impacto y migración con BREAKING CHANGE en el cuerpo o pie.

## Definition of Ready

- La tarjeta contiene ID, épica, contexto, persona, historia y criterios de aceptación observables.
- El equipo resolvió las decisiones de negocio y permisos aplicables; los datos de prueba están disponibles.
- Las dependencias de desarrollo están terminadas o existe un contrato simulado explícitamente acordado para trabajo preparatorio. La validación final exige las dependencias integradas.
- La historia permite un resultado verificable en aproximadamente uno a tres días de trabajo. Si excede ese tamaño, el equipo aplica slicing antes de iniciarla.
- Hay un responsable, un revisor distinto y capacidad bajo el límite de trabajo en curso. La tarjeta enlaza su referencia de diseño cuando corresponde.

## Definition of Done

- Todos los criterios de aceptación tienen evidencia reproducible, incluidos los resultados de error aplicables.
- Pasan las pruebas pertinentes, compilación, tipos y lint. En cambios de acceso o datos se comprueban rol, sección, datos propios e institución.
- Un integrante distinto del autor revisó el PR y sus observaciones están resueltas.
- El cambio está integrado en main y validado en el entorno de demostración. Estar en develop por sí solo no completa la tarjeta.
- La documentación, migraciones y estrategia de reversión están actualizadas cuando corresponda. No se incorporan credenciales ni datos reales de alumnos.
- La tarjeta enlaza PR, commit o versión y evidencia. Se registra quién validó y la fecha. Las comprobaciones no aplicables se justifican, no se marcan como hechas.
