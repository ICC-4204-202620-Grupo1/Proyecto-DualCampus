# H24 · Publicar material de curso

Rama feature/H24-publicar-material-curso, basada en H23. Implementación local pendiente de revisión.

## Decisión del piloto

Formato PDF o TXT UTF-8, tamaño de 1 byte a 1 MiB (1 048 576 bytes), título hasta 200 caracteres y nombre hasta 180. Son límites de esta implementación, ya que el catálogo no fija formatos ni tamaño. Se validan en cliente y servidor. Para PDF se comprueban cabecera y marcador final; no constituye validación completa del documento ni análisis antivirus.

El contenido se guarda en PostgreSQL (bytea), junto con los metadatos, en una transacción que también escribe la auditoría. Evita depender de disco efímero o de un proveedor externo en esta iteración. Es adecuado para documentos pequeños del piloto; volúmenes mayores requieren decidir almacenamiento de objetos y revisar límites de infraestructura.

## Recorrido

Aplicar npm run db:migrar. Entrar como Profesor Demo, seleccionar período y sección. Debajo de las evaluaciones aparece Materiales del curso: completar título, seleccionar PDF/TXT y pulsar Publicar material. Solo se muestra como publicado después del guardado completo. Reabrir conserva título, nombre, tamaño, autor y fecha.

Archivo vacío, extensión/tipo no permitidos, tamaño excedido o contenido incompatible muestran rechazo. Administrador, ayudante, alumno y profesor ajeno no pueden publicar. Alumnos inscritos y equipo pueden consultar metadatos del catálogo. Las descargas autorizadas se implementan en H25; H24 no publica archivos mediante rutas estáticas.

## API y acceso

GET /api/materiales/secciones/:id devuelve permiso puedePublicar y metadatos. POST en la misma ruta recibe JSON con titulo, nombreArchivo, tipo y contenidoBase64. El cuerpo tiene límite de 1500 KiB solo para estas rutas; el resto conserva 100 KiB. La sesión, institución esperada y validación de origen existentes siguen vigentes.

Publicación exige rol PROFESOR vigente y asignación como PROFESOR de la sección; un administrador sin esa asignación no publica. Migración 010_material_curso.sql con RLS forzada y referencia compuesta a sección/institución. La consulta no devuelve contenido. Evento PUBLICAR_MATERIAL vinculado a sección con materialId, título, archivo y tamaño.

## Verificación

npm run build; npm run test:api con TEST_DATABASE_URL hacia base exclusiva terminada en _test; git diff --check. Pruebas de persistencia de bytes, cargas mayores de 100 KiB, límite de 1 MiB, errores, permisos, aislamiento y rollback completo ante fallo de auditoría.

## Reversión

Revertir aplicación conservando tabla y archivos; no eliminar materiales almacenados. No requiere nuevas credenciales ni servicios externos.
