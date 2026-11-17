# Manual de inicio y operación de DualCampus

**Versión:** 17 de noviembre de 2026 · **Dirigido a:** personal de la universidad, docentes, ayudantes, estudiantes y egresados.

Este manual describe la aplicación web para usuarios reales. Acceda a **https://proyecto-dualcampus.vercel.app/** y guarde esa dirección entre sus favoritos. No use `localhost`, accesos de prueba ni cuentas de demostración para operar datos reales. Necesita un navegador actualizado, conexión a Internet y una cuenta Google autorizada por la universidad.

## 1. Primer ingreso y navegación

1. Abra **https://proyecto-dualcampus.vercel.app/**. En **Iniciar sesión**, elija **Institucional** y pulse **Continuar con Google**. Seleccione el correo institucional que fue habilitado. La aplicación no le pide crear una contraseña propia.
2. Si tiene acceso a más de una universidad, use **Institución activa**, en la parte superior de la pantalla, para escoger dónde trabajará. Los datos y permisos cambian con esa selección.
3. Use el menú lateral para ir a cada módulo. En un teléfono, ábralo con **☰**; puede cerrarlo con **Cerrar** o tocando fuera. En escritorio puede contraerlo y expandirlo.
4. Antes de trabajar con una sección, seleccione el **Período de trabajo**. Puede hacerlo en **Inicio** o **Períodos académicos**. Después entre a **Mis secciones** o **Cursos y secciones**, abra la tarjeta del curso y elija la **Sección de trabajo**. En cada módulo verifique el período y la sección mostrados: las acciones se aplican a esa selección.
5. Puede recorrer las pestañas de la sección (**Resumen**, **Notas**, **Materiales**, **Actividades**, **Asistencia** y las que permita su rol) o usar los mismos destinos en el menú lateral. En **Apariencia** puede elegir **Automático**, **Claro** u **Oscuro**. **Cerrar sesión** está arriba a la derecha.

Si aparece **Tu cuenta no está habilitada**, solicite a la administración que registre su correo y rol en la universidad correspondiente. Si no ve una opción de este manual, compruebe primero institución, período, sección y rol. Un período sin secciones o una sección sin nómina mostrará pantallas vacías hasta que la administración cargue esos datos.

## 2. Administración global: universidades y usuarios

Estas opciones aparecen al **superadministrador**.

- **Universidades → Crear universidad:** escriba el nombre oficial y confirme. La nueva universidad aparece en **Instituciones registradas**.
- **Usuarios y roles → Registrar usuario:** ingrese nombre, correo institucional, universidad y rol; pulse **Crear usuario**. El usuario podrá entrar con esa misma cuenta Google.
- **Usuarios y roles → Asignar otro rol:** seleccione usuario, universidad y rol y pulse **Asignar rol**. Una persona puede tener distintas asignaciones. En **Usuarios registrados**, **Quitar** retira una asignación tras la confirmación; compruebe cuidadosamente a quién afecta.

Para preparar una universidad desde cero, cree primero la universidad y sus usuarios con los roles necesarios. Luego continúe con el período, cursos, secciones, equipo y nómina según el apartado siguiente.

## 3. Administración académica: períodos, cursos y nóminas

Estas acciones corresponden al rol **ADMINISTRADOR** de la institución activa.

1. Entre a **Períodos académicos**. Escriba **Nombre**, **Inicio** y **Término** y pulse **Crear período**. Compruebe que aparece en **Período de trabajo**. Use **Calendario académico** para consultar sus fechas.
2. Seleccione ese período y entre a **Cursos y secciones**. En **Registrar curso**, complete código, nombre y, si corresponde, facultad; pulse **Crear curso**.
3. En **Abrir sección en este período**, seleccione el curso, escriba el código de sección y pulse **Crear sección**. Abra la tarjeta de la sección creada.
4. Entre a **Equipo y nómina** (o la pestaña **Nómina**). En **Equipo docente**, seleccione un profesor y, si corresponde, marque ayudantes; pulse **Guardar equipo**. Los docentes deben estar previamente habilitados en esa universidad.
5. En **Cargar nómina oficial**, pegue **un correo institucional por línea** y pulse **Validar nómina**. Revise cada fila de la vista previa. Si es válida, pulse **Confirmar carga** y compruebe los nombres en **Nómina de la sección**. La carga agrega alumnos habilitados y conserva los ya existentes.

**Validar lote histórico**, dentro de **Cursos y secciones**, acepta CSV con encabezado `identidad,curso,escala,nota` y el botón **Previsualizar lote**. Esta pantalla **solo valida y muestra el resultado: no importa ni guarda registros históricos**. No dé por completada una migración con esa previsualización.

En **Estado de avisos**, use **Actualizar** para revisar los avisos de publicación de notas. Si un aviso figura como **FALLIDO**, puede pulsar **Reintentar**. La nota se consulta dentro de la aplicación; el aviso no incluye la calificación.

## 4. Profesor: preparar y conducir una sección

Seleccione período y sección siguiendo el apartado 1. La sección debe tener profesor asignado y estudiantes en la nómina.

### Evaluaciones, revisión y publicación de notas

1. Abra **Evaluaciones y notas** (pestaña **Notas**). Pulse **+ Nueva evaluación**, complete nombre, fecha y ponderación porcentual y pulse **Crear evaluación**.
2. En la evaluación, abra **Calificar** o **Ver planilla**. El ayudante, cuando esté asignado, registra las notas o ausencias y pulsa **Guardar notas y ausencias**; luego **Enviar a revisión**. Si el profesor devuelve la evaluación, el ayudante corrige, vuelve a guardar y pulsa **Reenviar a revisión**.
3. Como profesor, abra la planilla **EN_REVISION**. Si requiere cambios, escriba un **Comentario de devolución** y pulse **Devolver evaluación**. Si está correcta, pulse **Publicar notas aprobadas**. **Solo después de publicar** los estudiantes ven sus notas oficiales.
4. La planilla incluye **Historial de la evaluación** para consultar sus eventos. Una nota ya publicada solo la corrige el **administrador**: abre la evaluación, selecciona **Corregir nota de…**, escribe nueva nota, motivo y referencia, y confirma **Confirmar corrección publicada**. No use la devolución para alterar una evaluación publicada.

### Materiales

En **Materiales de clase**, pulse **+ Publicar material**, escriba título, seleccione un archivo **PDF o TXT de hasta 1 MB** y pulse **Publicar material**. Compruebe que aparece en la lista. **Vista previa** abre el documento dentro de la página; **Descargar material** guarda una copia.

Para reutilizar un documento de otra sección autorizada, pulse **Reutilizar material**, seleccione **Material anterior** y **Copiar como borrador**. En **Copias pendientes de revisión**, revise el título. Si lo modifica, pulse **Guardar cambios**. Por último, pulse **Publicar copia revisada**; mientras esté en borrador, los estudiantes no la ven.

### Actividades y entregas

En **Actividades y entregas**, pulse **+ Nueva actividad**, ingrese título e instrucciones y pulse **Crear actividad**. En esa actividad, pulse **Configurar entrega**: establezca apertura, cierre, formatos permitidos (**PDF, DOCX, TXT o PNG**) y tamaño máximo entre **1 y 50 MB**; pulse **Guardar condiciones**. **Ver informes recibidos** muestra los archivos enviados y permite **Descargar** cada uno. También puede consultar los informes de toda la sección cuando aparece **Informes recibidos en la sección**.

### Asistencia y anuncios

En **Asistencia**, pulse **+ Registrar nueva clase**, seleccione fecha y **Registrar clase**. Elija la clase, marque **Presente** o **Ausente** para cada alumno y pulse **Guardar asistencia**. Para cambiar un registro ya guardado, escriba el **Motivo** junto al alumno y pulse **Corregir**. Consulte **Asistencia agregada** para el resumen de la sección.

En **Anuncios de sección**, complete título y mensaje y pulse **Publicar anuncio**. Verifique que aparece en **Anuncios publicados**. Los estudiantes de esa sección lo podrán consultar. **Distribución de notas** muestra el resumen de calificaciones ya publicadas.

## 5. Ayudante: registrar notas y apoyar la sección

Entre con su cuenta institucional, seleccione período y sección asignada. En **Evaluaciones y notas**, abra **Calificar** o **Ver planilla**. Registre la nota de cada estudiante dentro de la escala indicada o marque su ausencia; pulse **Guardar notas y ausencias**. Cuando la planilla esté completa, pulse **Enviar a revisión**. Si el profesor la devuelve, lea **Observación del profesor**, corrija, guarde y pulse **Reenviar a revisión**. El ayudante **no publica** notas. Puede consultar las secciones, materiales, actividades y asistencia según los permisos mostrados en la pantalla.

## 6. Estudiante: cursos, entregas y resultados

1. Entre con **Institucional → Continuar con Google**, elija institución y período, y abra su sección desde **Inicio → Abrir espacio de trabajo** o **Mis secciones**.
2. En **Materiales de clase**, use **Vista previa** o **Descargar material**. En **Anuncios de sección**, lea los avisos del profesor.
3. En **Actividades y entregas**, lea instrucciones, apertura, cierre, formatos y tamaño máximo. En **Archivo para entregar**, seleccione el archivo y pulse **Enviar archivo**. Espere el **Comprobante de entrega** y compruebe nombre, actividad y hora. Puede usar **Descargar mi entrega**. Si la actividad sigue admitiendo entregas y necesita sustituir el archivo, seleccione el nuevo y pulse **Reemplazar archivo**; compruebe el nuevo comprobante. Si el envío falla, conserve el archivo seleccionado y pulse **Reintentar envío**.
4. En **Mis calificaciones**, pulse **Actualizar notas** si acaba de publicarse una evaluación. Solo aparecen notas publicadas. En **Mi asistencia**, consulte las clases registradas y su proporción. **Historial académico** muestra los antecedentes disponibles por período y curso.
5. En **Mi perfil**, antes de egresar, pulse **Vincular cuenta personal** y complete la autorización con Google para dejar asociado su correo personal. Compruebe en la misma pantalla el resultado de la vinculación.

## 7. Egresado: acceso a antecedentes

La cuenta personal debe haberse vinculado previamente desde **Mi perfil** mientras el usuario tenía acceso como estudiante. En la pantalla inicial, elija **Egresados → Ingresar como egresado** y seleccione esa cuenta Google. En **Mis antecedentes académicos** consulte el historial disponible; use **Actualizar historial** para recargarlo y **Cerrar sesión** al terminar. Si la cuenta no está vinculada o Google no verifica su correo, contacte a **Registro Curricular de su institución**, indicando nombre y antiguo correo institucional. Ese canal gestiona la recuperación; el egresado no puede vincularse por primera vez desde la pantalla de ingreso.

## 8. Director: indicadores y reportes

Entre con su cuenta institucional, seleccione institución y período y abra **Indicadores institucionales**. Revise los totales y estadísticas agregadas; use el filtro de **Facultad** cuando esté disponible y **Descargar reporte CSV** para conservar el resultado actual. La aplicación oculta cifras de grupos pequeños según sus reglas de privacidad; **Oculto** no equivale a cero.

En **Reportes periódicos**, elija frecuencia **Diaria**, **Semanal** o **Mensual** y pulse **Programar reporte**. La tabla muestra destino, próxima ejecución, último resultado y estado. Para detener un envío activo, pulse **Cancelar**. Los informes se envían al correo institucional del director y vuelven a comprobar permisos y privacidad en cada ejecución.

## 9. Problemas habituales

| Situación | Qué hacer |
| --- | --- |
| No puedo ingresar con Google | Use el correo institucional habilitado. Si la aplicación indica falta de autorización, solicite al administrador o Registro Curricular que revise su cuenta, universidad y rol. |
| No aparece un curso o módulo | Verifique **Institución activa**, **Período de trabajo** y **Sección de trabajo**. El administrador debe crear la sección y cargar la nómina o asignar el equipo. Los módulos dependen de su rol. |
| La nota no aparece al estudiante | El profesor debe haber pulsado **Publicar notas aprobadas**. Una planilla guardada, enviada o devuelta todavía no es pública. |
| No puedo enviar un archivo | Compruebe ventana de apertura/cierre, formato y tamaño indicados en la actividad. Espere el comprobante tras enviar. |
| No se ve una vista previa PDF | Use **Descargar material** y abra el archivo con un lector PDF. |
| Un dato no carga | Pulse **Reintentar** o **Actualizar** donde esté disponible; si persiste, cierre sesión e informe a soporte institucional con módulo y hora del problema. Evite enviar contraseñas o datos académicos sensibles por correo. |

**Orden recomendado de puesta en uso:** superadministrador crea universidad y usuarios → administrador crea período, curso, sección, equipo y nómina → profesor publica materiales, actividades, clases, anuncios y evaluaciones → ayudante envía notas a revisión → profesor publica las notas → estudiante consulta resultados y entrega actividades → director consulta indicadores. Este orden permite probar los flujos con datos reales desde la propia aplicación.
