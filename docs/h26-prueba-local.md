# H26 · Reutilizar material entre períodos

Rama `feature/H26-reutilizar-material`, creada desde `origin/develop`. Requiere la migración `014_reutilizacion_material.sql`.

## Flujo local

1. Entrar como profesor y abrir una sección destino en un período distinto al material original.
2. En **Materiales del curso**, usar **Reutilizar material de otra sección**. Solo aparecen materiales publicados de otras secciones de la misma institución donde el usuario es profesor.
3. Seleccionar un material y revisar su título, archivo, tamaño, período, curso y sección de origen.
4. Pulsar **Copiar como borrador**. La copia aparece en **Copias pendientes de revisión** y todavía no es visible ni descargable para el alumnado.
5. Cambiar el título y guardar. El material original conserva su título y contenido.
6. Pulsar **Publicar copia revisada**. Desde ese momento aparece entre los materiales publicados de la sección destino y el alumnado matriculado puede descargarla.

## Consistencia y acceso

La copia duplica el archivo dentro de una transacción, conserva una referencia al material original y empieza con estado `BORRADOR` y sin fecha de publicación. La base exige que origen y copia pertenezcan a la misma institución. El servicio exige que el profesor esté asignado tanto a la sección de origen como a la de destino y que pertenezcan a períodos distintos.

Preparar, editar y publicar generan eventos académicos separados. Si falla el registro del evento, la operación se revierte. Los listados y descargas del alumnado filtran `estado='PUBLICADO'`.

## Verificación

`npm run build`, suite completa de API y `git diff --check`. La suite H26 cubre selección autorizada, borrador invisible, publicación posterior, descarga, independencia del original, permisos y rollback transaccional.
