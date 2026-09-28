# Tarjetas de DualCampus

Propuesta de desglose para validar por el Grupo 1. Estado inicial: Refinamiento.

## E1 Acceso institucional

### H01 Iniciar sesión con Google

**Tarjeta en Trello:** https://trello.com/c/70m8H9f3

**Contexto:** La identidad se delega a Google Workspace y el acceso depende de roles locales.

Como Benjamin Alonso, quiero ingresar con mi cuenta institucional de Google, para acceder sin una contraseña adicional.

**Criterios de aceptación:**

- [ ] CA1: Una cuenta institucional habilitada accede y conserva su identidad al recargar la página.
- [ ] CA2: Una cuenta sin rol habilitado no accede a datos académicos.
- [ ] CA3: Una sesión expirada exige autenticarse y no muestra datos protegidos.

**Dependencias:** Ninguna. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H02 Seleccionar la institución activa

**Tarjeta en Trello:** https://trello.com/c/KKtmqZ85

**Contexto:** El profesor trabaja en ambas instituciones, pero opera solo en una a la vez.

Como Benjamin Alonso, quiero cambiar entre mis instituciones autorizadas, para gestionar cada universidad por separado.

**Criterios de aceptación:**

- [ ] CA1: El selector muestra únicamente las instituciones en que el usuario tiene un rol.
- [ ] CA2: Al cambiar de institución se actualizan cursos y datos y se identifica la institución activa.
- [ ] CA3: Solicitar un recurso de una institución no autorizada no devuelve su contenido.

**Dependencias:** H01. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H03 Aplicar permisos por rol y sección

**Tarjeta en Trello:** https://trello.com/c/fZ9QnpKb

**Contexto:** Se aplica la matriz del informe 3 y la negación por defecto. Los roles iniciales se precargan en el piloto.

Como Rodolfo Ávila, quiero que cada usuario acceda solo a las acciones y datos autorizados, para resguardar la información académica.

**Criterios de aceptación:**

- [ ] CA1: El ayudante no puede aprobar notas y el director no obtiene notas individuales.
- [ ] CA2: Un docente solo accede a secciones asignadas y un alumno solo a sus datos y cursos.
- [ ] CA3: Una petición directa a la API tampoco permite eludir esos límites.

**Dependencias:** H02. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Regla de negocio.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H04 Vincular acceso para el egreso

**Tarjeta en Trello:** https://trello.com/c/7uz5662H

**Contexto:** El riesgo R02 propone una identidad alternativa. Su política debe confirmarse con el cliente.

Como Tomás Alcaíno, quiero vincular una cuenta personal verificada antes de egresar, para conservar el acceso a mi historial.

**Criterios de aceptación:**

- [ ] CA1: La vinculación requiere una sesión vigente y comprobar la propiedad de la cuenta personal.
- [ ] CA2: La cuenta vinculada identifica al mismo alumno y mantiene solo la consulta de su historial al egresar.
- [ ] CA3: Una cuenta ya asociada a otra persona se rechaza y el intento queda registrado.

**Dependencias:** H03. **Decisiones previas:** D3.
**Prioridad:** Posterior. **Slicing:** Contexto de usuario.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

## E2 Configuración académica

### H05 Crear el período académico

**Tarjeta en Trello:** https://trello.com/c/r1Zu7qnK

**Contexto:** La configuración previa al semestre debe conservar autor y fecha.

Como Rodolfo Ávila, quiero registrar el período de una institución, para preparar el semestre correcto.

**Criterios de aceptación:**

- [ ] CA1: El administrador guarda nombre, institución y fechas coherentes de inicio y término.
- [ ] CA2: Un período repetido en la misma institución se rechaza sin crear duplicados.
- [ ] CA3: Al consultar nuevamente se recuperan los datos y el registro de quién lo creó.

**Dependencias:** H03. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H06 Registrar cursos y secciones

**Tarjeta en Trello:** https://trello.com/c/xV11gEIJ

**Contexto:** Los cursos pertenecen a la institución activa y las secciones a un período.

Como Rodolfo Ávila, quiero registrar cursos y sus secciones en un período, para ordenar la oferta académica.

**Criterios de aceptación:**

- [ ] CA1: Un curso y una sección válidos quedan asociados al período seleccionado.
- [ ] CA2: El sistema impide códigos duplicados en el mismo ámbito y referencias a otra institución.
- [ ] CA3: La lista del período permite revisar los cursos y sus secciones guardadas.

**Dependencias:** H05. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H07 Asignar profesores y ayudantes

**Tarjeta en Trello:** https://trello.com/c/3dIpOKsb

**Contexto:** Solo se asignan usuarios habilitados de la institución.

Como Rodolfo Ávila, quiero asignar el equipo docente de cada sección, para dejar habilitado su trabajo académico.

**Criterios de aceptación:**

- [ ] CA1: La sección muestra el profesor y los ayudantes asignados después de guardar.
- [ ] CA2: Un usuario de otra institución sin rol local no se puede asignar.
- [ ] CA3: La asignación habilita el acceso correspondiente y su modificación deja autor y fecha.

**Dependencias:** H06. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H08 Cargar y consultar la nómina oficial

**Tarjeta en Trello:** https://trello.com/c/qBGgS5QX

**Contexto:** Se copia la nómina oficial. DualCampus no realiza inscripción ni toma de ramos.

Como Rodolfo Ávila, quiero cargar la nómina recibida del sistema de inscripción, para mantener los alumnos de cada sección.

**Criterios de aceptación:**

- [ ] CA1: Una lista válida asocia alumnos existentes a una sección y permite consultar el total.
- [ ] CA2: Las filas inválidas se identifican con su motivo antes de confirmar la carga.
- [ ] CA3: Repetir la misma carga no duplica alumnos y el docente ve la nómina de su sección.

**Dependencias:** H07. **Decisiones previas:** D5.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H09 Registrar un retiro informado

**Tarjeta en Trello:** https://trello.com/c/01CyUeEK

**Contexto:** Se actualiza el estado recibido desde el sistema externo, sin tramitar el retiro.

Como Rodolfo Ávila, quiero reflejar un retiro comunicado oficialmente, para mantener actualizada la nómina sin perder antecedentes.

**Criterios de aceptación:**

- [ ] CA1: El registro exige alumno, sección, fecha y referencia del retiro oficial.
- [ ] CA2: El alumno deja de aparecer como activo y su información histórica se conserva.
- [ ] CA3: Quedan visibles el responsable, la fecha y el motivo de la actualización.

**Dependencias:** H08. **Decisiones previas:** Ninguna adicional.
**Prioridad:** Posterior. **Slicing:** Regla de negocio.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H10 Consultar el calendario académico

**Tarjeta en Trello:** https://trello.com/c/xpVYMeBs

**Contexto:** La matriz permite consultar el calendario a los cinco roles. La fuente inicial son las fechas del período.

Como Tomás Alcaíno, quiero consultar fechas del período, para organizar mis actividades.

**Criterios de aceptación:**

- [ ] CA1: La vista muestra las fechas del período de la institución activa.
- [ ] CA2: Al cambiar de período se muestran sus fechas sin mezclar instituciones.
- [ ] CA3: Profesor, ayudante, alumno, administrador y director pueden consultar la vista.

**Dependencias:** H05. **Decisiones previas:** Ninguna adicional.
**Prioridad:** Posterior. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

## E3 Calificaciones con trazabilidad

### H11 Crear una evaluación presencial

**Tarjeta en Trello:** https://trello.com/c/LCHj0R4W

**Contexto:** La prueba se realiza en papel. Se registra su referencia y escala, sin evaluación online.

Como Javiera Ossandón, quiero registrar una evaluación de mi sección, para organizar el posterior ingreso de notas.

**Criterios de aceptación:**

- [ ] CA1: El profesor asignado guarda nombre y fecha y la evaluación aparece en su sección.
- [ ] CA2: El ayudante no puede crear evaluaciones.
- [ ] CA3: La evaluación utiliza la escala acordada para la institución, sin aceptar límites incoherentes.

**Dependencias:** H08. **Decisiones previas:** D1.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H12 Guardar notas en borrador

**Tarjeta en Trello:** https://trello.com/c/meg8mhMd

**Contexto:** El informe 3 contempla autoguardado y permite ingreso al profesor y al ayudante.

Como Diego Riquelme, quiero ingresar y recuperar notas en borrador, para evitar pérdida de digitación.

**Criterios de aceptación:**

- [ ] CA1: Las notas válidas se guardan y se recuperan al reabrir la evaluación.
- [ ] CA2: Un valor fuera de escala se rechaza sin sustituir la última nota válida; ausente queda diferenciado de cero.
- [ ] CA3: Profesor y ayudante asignados pueden editar el borrador; el alumno no ve notas sin publicar.

**Dependencias:** H11. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Paso del flujo.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H13 Enviar notas a revisión

**Tarjeta en Trello:** https://trello.com/c/bFU18P2B

**Contexto:** El envío congela la edición del conjunto y cambia su estado.

Como Diego Riquelme, quiero enviar una evaluación completa al profesor, para dejar constancia de que puede revisarla.

**Criterios de aceptación:**

- [ ] CA1: Con todas las filas resueltas mediante nota válida o ausencia explícita, el estado pasa a En revisión.
- [ ] CA2: Una fila incompleta impide enviar y se indica cuál falta.
- [ ] CA3: En revisión se bloquea la edición, incluso mediante peticiones directas, y queda fecha y autor del envío.

**Dependencias:** H12. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Paso del flujo.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H14 Aprobar y publicar calificaciones

**Tarjeta en Trello:** https://trello.com/c/bl0X5pRu

**Contexto:** Publicar es una facultad exclusiva del profesor de la sección.

Como Javiera Ossandón, quiero aprobar las notas revisadas, para poner los resultados oficiales a disposición de mis alumnos.

**Criterios de aceptación:**

- [ ] CA1: El profesor consulta la evaluación En revisión y puede aprobarla.
- [ ] CA2: La aprobación cambia a Publicada y habilita la consulta de las notas propias de cada alumno.
- [ ] CA3: Un ayudante o docente no asignado no puede publicar y la operación deja registro auditable.

**Dependencias:** H13. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Paso del flujo.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H15 Devolver y reenviar calificaciones

**Tarjeta en Trello:** https://trello.com/c/o1qae3Cl

**Contexto:** El ciclo de devolución es un camino alternativo a la aprobación.

Como Javiera Ossandón, quiero devolver notas con observaciones, para corregir errores antes de publicarlas.

**Criterios de aceptación:**

- [ ] CA1: La devolución exige un comentario y cambia de En revisión a Devuelta.
- [ ] CA2: El ayudante ve el comentario, corrige las notas y las conserva sin publicarlas.
- [ ] CA3: El reenvío vuelve a En revisión, bloquea la edición y conserva la observación previa.

**Dependencias:** H13. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Flujo alternativo.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H16 Consultar mis notas publicadas

**Tarjeta en Trello:** https://trello.com/c/iJcqjPTQ

**Contexto:** La visibilidad individual aplica solo al titular de la nota.

Como Tomás Alcaíno, quiero consultar las calificaciones publicadas de mis cursos, para conocer mis resultados.

**Criterios de aceptación:**

- [ ] CA1: El alumno ve evaluación, nota y estado publicado de sus cursos.
- [ ] CA2: Borradores y notas En revisión o Devueltas no exponen valores al alumno.
- [ ] CA3: Cambiar el identificador de alumno o sección no permite consultar notas ajenas.

**Dependencias:** H14. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Rol.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H17 Corregir una nota de cierre

**Tarjeta en Trello:** https://trello.com/c/kkR2ZJNe

**Contexto:** La operación extraordinaria corresponde solo al administrador y exige motivo.

Como Rodolfo Ávila, quiero corregir una nota final por solicitud formal, para resolver errores conservando el historial.

**Criterios de aceptación:**

- [ ] CA1: Una corrección autorizada exige nueva nota válida, motivo y referencia de la solicitud.
- [ ] CA2: Se conservan valor anterior, valor nuevo, autor y fecha sin borrar la trazabilidad.
- [ ] CA3: El alumno ve el valor corregido y ningún profesor o ayudante puede ejecutar esta operación.

**Dependencias:** H14. **Decisiones previas:** D7.
**Prioridad:** Posterior. **Slicing:** Regla de negocio.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H18 Consultar la trazabilidad de cambios

**Tarjeta en Trello:** https://trello.com/c/uBzYZwR8

**Contexto:** Los registros se generan desde cada operación, aunque la consulta se entregue después.

Como Rodolfo Ávila, quiero consultar quién modificó una evaluación, para respaldar la revisión de incidentes.

**Criterios de aceptación:**

- [ ] CA1: Una búsqueda por evaluación lista eventos en orden con autor, fecha y acción.
- [ ] CA2: Los cambios de nota muestran valor previo y posterior y motivo cuando corresponde.
- [ ] CA3: La consulta no ofrece editar o eliminar eventos y respeta la institución activa.

**Dependencias:** H14. **Decisiones previas:** D6.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

## E4 Materiales y entregas

### H19 Publicar material y syllabus

**Tarjeta en Trello:** https://trello.com/c/WOtz0YEL

**Contexto:** El material incluye PDFs, presentaciones y el syllabus.

Como Javiera Ossandón, quiero publicar documentos de mi sección, para compartir el contenido de clases.

**Criterios de aceptación:**

- [ ] CA1: Un archivo permitido con título queda asociado a la sección y aparece al consultar sus materiales.
- [ ] CA2: Un archivo que excede los límites acordados se rechaza con un mensaje claro.
- [ ] CA3: Solo el profesor asignado puede publicar y el archivo no aparece si la carga falla.

**Dependencias:** H07. **Decisiones previas:** D4.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H20 Consultar y descargar material

**Tarjeta en Trello:** https://trello.com/c/dcbSemsI

**Contexto:** Profesor y ayudante también consultan material de sus secciones.

Como Tomás Alcaíno, quiero descargar el material de mis cursos, para estudiar con los documentos del profesor.

**Criterios de aceptación:**

- [ ] CA1: El alumno inscrito ve el título del material y descarga el archivo correcto.
- [ ] CA2: Profesor y ayudante asignados pueden consultar el mismo material.
- [ ] CA3: Un usuario ajeno al curso no descarga el archivo, incluso si conoce su enlace.

**Dependencias:** H19, H08. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Rol.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H21 Reutilizar material entre períodos

**Tarjeta en Trello:** https://trello.com/c/mAqdWi5O

**Contexto:** Se atiende el desgaste documentado en la entrega 2. Se propone copia dentro de una institución.

Como Benjamin Alonso, quiero copiar material de una sección anterior, para preparar el semestre sin repetir cargas.

**Criterios de aceptación:**

- [ ] CA1: El profesor elige material de una sección de origen y una de destino en que está autorizado.
- [ ] CA2: La copia conserva el archivo y permite revisar título y sección antes de publicar.
- [ ] CA3: Cambiar la copia no altera el material anterior y no se permite copiar entre instituciones.

**Dependencias:** H19. **Decisiones previas:** D6.
**Prioridad:** Posterior. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H22 Habilitar la recepción de un informe

**Tarjeta en Trello:** https://trello.com/c/4ncpj4oy

**Contexto:** La recepción de documentos acompaña una evaluación presencial.

Como Javiera Ossandón, quiero definir instrucciones y plazo de una entrega, para recibir los archivos de mi evaluación.

**Criterios de aceptación:**

- [ ] CA1: El profesor guarda instrucciones, fecha y hora límite, formatos y tamaño máximo acordados.
- [ ] CA2: El alumno del curso puede consultar esas condiciones antes de subir el archivo.
- [ ] CA3: Un cierre anterior a la apertura se rechaza sin habilitar la entrega.

**Dependencias:** H11. **Decisiones previas:** D4.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H23 Enviar un archivo y obtener comprobante

**Tarjeta en Trello:** https://trello.com/c/P8R0ugQO

**Contexto:** El riesgo R06 exige confirmar almacenamiento antes de informar éxito.

Como Tomás Alcaíno, quiero subir mi informe y confirmar su recepción, para tener evidencia de que lo entregué.

**Criterios de aceptación:**

- [ ] CA1: Dentro de plazo, un archivo permitido queda almacenado y asociado al alumno y evaluación.
- [ ] CA2: Solo después de guardar el archivo se muestra comprobante con nombre y fecha de recepción.
- [ ] CA3: Una carga fallida o fuera de plazo no emite éxito y explica la causa sin afectar una entrega previa.

**Dependencias:** H22. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Flujo habitual.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H24 Consultar y descargar entregas

**Tarjeta en Trello:** https://trello.com/c/jLY5Mn1F

**Contexto:** Ayudante y profesor acceden a entregas de su sección; el alumno solo a las propias.

Como Javiera Ossandón, quiero consultar los informes de mi sección, para revisar el trabajo recibido.

**Criterios de aceptación:**

- [ ] CA1: Profesor y ayudante ven nombre del archivo, autor y fecha, y descargan el archivo recibido.
- [ ] CA2: El alumno consulta su comprobante y su propio archivo.
- [ ] CA3: Ni otro alumno ni un docente no asignado pueden descargar la entrega.

**Dependencias:** H23. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Rol.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H25 Recuperar una carga fallida

**Tarjeta en Trello:** https://trello.com/c/1hgotzsx

**Contexto:** El riesgo R06 propone reintento y reapertura excepcional por el profesor.

Como Tomás Alcaíno, quiero reanudar o reintentar una carga interrumpida, para completar la entrega sin perder el progreso disponible.

**Criterios de aceptación:**

- [ ] CA1: Una interrupción permite reintentar sin duplicar una entrega confirmada.
- [ ] CA2: El intento fallido conserva fecha y motivo para su revisión por el profesor.
- [ ] CA3: Una reapertura autorizada se limita al alumno y plazo indicados y queda registrada.

**Dependencias:** H23. **Decisiones previas:** D4 D6.
**Prioridad:** Posterior. **Slicing:** Flujo infeliz.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

## E5 Registro de asistencia

### H26 Registrar asistencia por clase

**Tarjeta en Trello:** https://trello.com/c/ROLiYyXf

**Contexto:** La asistencia está en el alcance previo, pero falta su matriz de permisos.

Como Javiera Ossandón, quiero registrar la asistencia de mi sección, para mantener evidencia de participación.

**Criterios de aceptación:**

- [ ] CA1: El profesor asignado registra una clase y resuelve la asistencia de cada alumno activo.
- [ ] CA2: Al reabrir la clase se recuperan exactamente los valores guardados.
- [ ] CA3: Un usuario no autorizado no altera asistencia y cada registro identifica autor y fecha.

**Dependencias:** H08. **Decisiones previas:** D2.
**Prioridad:** Posterior. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H27 Consultar asistencia propia

**Tarjeta en Trello:** https://trello.com/c/sS3mhYnX

**Contexto:** Se propone consulta individual del alumno y denominador explícito para el porcentaje.

Como Tomás Alcaíno, quiero consultar mis registros de asistencia, para detectar posibles diferencias.

**Criterios de aceptación:**

- [ ] CA1: El alumno ve su estado por clase registrada, sin datos de otros alumnos.
- [ ] CA2: La vista muestra presentes y total de clases consideradas y calcula su proporción.
- [ ] CA3: Con cero clases válidas se muestra Sin datos y no un porcentaje inventado.

**Dependencias:** H26. **Decisiones previas:** D2.
**Prioridad:** Posterior. **Slicing:** Rol.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H28 Corregir un registro de asistencia

**Tarjeta en Trello:** https://trello.com/c/Ovz1HRhc

**Contexto:** Se conserva el dato anterior para respaldar la corrección.

Como Javiera Ossandón, quiero corregir una marca equivocada, para mantener un registro preciso.

**Criterios de aceptación:**

- [ ] CA1: El profesor autorizado cambia una marca con motivo obligatorio.
- [ ] CA2: Se conservan el estado previo, el nuevo, autor, fecha y motivo.
- [ ] CA3: La consulta individual y las métricas posteriores usan el dato corregido.

**Dependencias:** H26. **Decisiones previas:** D2.
**Prioridad:** Posterior. **Slicing:** Flujo infeliz.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

## E6 Historial académico

### H29 Importar historial validado

**Tarjeta en Trello:** https://trello.com/c/KJ3Gi93R

**Contexto:** El riesgo R01 propone lotes conciliados con Registro Curricular.

Como Rodolfo Ávila, quiero importar calificaciones históricas verificadas, para centralizar los registros dispersos.

**Criterios de aceptación:**

- [ ] CA1: La vista previa identifica filas inválidas por identidad, sección o escala y explica el rechazo.
- [ ] CA2: Solo un lote validado y conciliado se confirma, con identificador y totales de control.
- [ ] CA3: El mismo lote no duplica registros y una reversión elimina únicamente sus efectos sin alterar datos posteriores.

**Dependencias:** H08. **Decisiones previas:** D5.
**Prioridad:** Posterior. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H30 Consultar historial por período

**Tarjeta en Trello:** https://trello.com/c/cjdDrK0Y

**Contexto:** La consulta funciona con notas publicadas actuales. La importación histórica amplía su contenido después.

Como Tomás Alcaíno, quiero consultar mis calificaciones por período y asignatura, para revisar mi trayectoria académica.

**Criterios de aceptación:**

- [ ] CA1: El alumno selecciona un período y consulta asignaturas y calificaciones propias disponibles.
- [ ] CA2: Un período sin registros muestra Sin datos y no calificaciones supuestas.
- [ ] CA3: Las notas importadas validadas aparecen cuando existe un lote confirmado, sin exponer datos ajenos.

**Dependencias:** H16. **Decisiones previas:** Ninguna adicional.
**Prioridad:** MVP. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H31 Consultar historial tras el egreso

**Tarjeta en Trello:** https://trello.com/c/DeJld3db

**Contexto:** Se utiliza la identidad personal vinculada según la política acordada.

Como Tomás Alcaíno, quiero consultar mi historial después de egresar, para acceder a mis antecedentes académicos.

**Criterios de aceptación:**

- [ ] CA1: Con la cuenta institucional deshabilitada, la cuenta vinculada permite consultar el historial del mismo alumno.
- [ ] CA2: El egresado no modifica datos ni accede a cursos de terceros.
- [ ] CA3: Sin vinculación verificada se informa el canal de asistencia de Registro Curricular.

**Dependencias:** H04, H30. **Decisiones previas:** D3.
**Prioridad:** Posterior. **Slicing:** Contexto de usuario.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

## E7 Reportería institucional

### H32 Consultar métricas de mi curso

**Tarjeta en Trello:** https://trello.com/c/39JDhp7A

**Contexto:** La matriz permite métricas al profesor asignado. Las notas usadas deben estar publicadas.

Como Benjamin Alonso, quiero consultar rendimiento y asistencia de mi sección, para identificar necesidades de seguimiento.

**Criterios de aceptación:**

- [ ] CA1: El profesor selecciona su sección y ve distribución de notas publicadas y asistencia registrada.
- [ ] CA2: Los indicadores explicitan período, cantidad de datos y denominadores utilizados.
- [ ] CA3: Un docente no asignado no consulta estas métricas y la ausencia de datos se muestra expresamente.

**Dependencias:** H16, H26. **Decisiones previas:** D2.
**Prioridad:** Posterior. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H33 Consultar reportes institucionales agregados

**Tarjeta en Trello:** https://trello.com/c/TUWgDkPi

**Contexto:** El informe 3 fija grupos de al menos cinco alumnos y una institución activa.

Como Rodrigo Manríquez, quiero filtrar indicadores por facultad y período, para evaluar el desempeño sin identificar alumnos.

**Criterios de aceptación:**

- [ ] CA1: El director obtiene indicadores agregados de la institución activa sin nombres ni identificadores individuales.
- [ ] CA2: Se suprimen grupos con menos de cinco alumnos y combinaciones que permitan inferir un grupo pequeño.
- [ ] CA3: Los filtros y totales no permiten reconstruir valores individuales y una consulta directa tampoco devuelve el detalle.

**Dependencias:** H32. **Decisiones previas:** Ninguna adicional.
**Prioridad:** Posterior. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H34 Exportar un reporte agregado

**Tarjeta en Trello:** https://trello.com/c/RXICpr7N

**Contexto:** Las restricciones se mantienen también en el archivo exportado.

Como Rodrigo Manríquez, quiero exportar el reporte que estoy consultando, para compartir indicadores autorizados.

**Criterios de aceptación:**

- [ ] CA1: La exportación identifica filtros, período y fecha, y coincide con los datos visibles.
- [ ] CA2: El archivo conserva la supresión de grupos pequeños y no incluye identificadores individuales.
- [ ] CA3: Sin permiso vigente se rechaza la descarga.

**Dependencias:** H33. **Decisiones previas:** Ninguna adicional.
**Prioridad:** Posterior. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H35 Programar un reporte periódico

**Tarjeta en Trello:** https://trello.com/c/MXRd1Ft7

**Contexto:** La matriz del informe 3 incluye la programación; el Worker ejecuta tareas diferidas.

Como Rodrigo Manríquez, quiero programar reportes agregados, para recibir información periódica sin repetir la consulta.

**Criterios de aceptación:**

- [ ] CA1: El director guarda filtros, frecuencia y destino institucional autorizado.
- [ ] CA2: Al ejecutarse se revalidan permisos y privacidad y queda fecha y estado del resultado.
- [ ] CA3: El director puede cancelar la programación y una ejecución fallida no se registra como exitosa.

**Dependencias:** H34. **Decisiones previas:** D8.
**Prioridad:** Posterior. **Slicing:** Optimización posterior.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

## E8 Comunicación académica

### H36 Publicar un anuncio del curso

**Tarjeta en Trello:** https://trello.com/c/3WC9JySN

**Contexto:** La comunicación está en la entrega 2. Se propone un canal de anuncios, con permisos pendientes.

Como Javiera Ossandón, quiero publicar un anuncio en mi sección, para comunicar indicaciones en un canal común.

**Criterios de aceptación:**

- [ ] CA1: El profesor asignado guarda título y mensaje y el anuncio aparece en su sección.
- [ ] CA2: Un usuario no autorizado no puede publicar.
- [ ] CA3: La publicación identifica autor y fecha y no aparece en otra institución.

**Dependencias:** H07. **Decisiones previas:** D2.
**Prioridad:** Posterior. **Slicing:** Operación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H37 Consultar anuncios de mis cursos

**Tarjeta en Trello:** https://trello.com/c/y4FoRq31

**Contexto:** El primer corte aborda comunicación unidireccional. Mensajería bidireccional requiere validación adicional.

Como Tomás Alcaíno, quiero consultar los anuncios de mis secciones, para conocer las indicaciones del profesor.

**Criterios de aceptación:**

- [ ] CA1: El alumno inscrito ve anuncios ordenados por fecha con título, mensaje y autor.
- [ ] CA2: El alumno no ve anuncios de cursos ajenos ni de otra institución.
- [ ] CA3: Una sección sin anuncios muestra ese estado con claridad.

**Dependencias:** H36, H08. **Decisiones previas:** D2.
**Prioridad:** Posterior. **Slicing:** Rol.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.

### H38 Recibir avisos de notas por correo

**Tarjeta en Trello:** https://trello.com/c/4GJ2dQOB

**Contexto:** El correo es un aviso y la plataforma conserva la información oficial, según R14.

Como Tomás Alcaíno, quiero recibir un aviso cuando se publique o corrija una nota, para saber cuándo consultar la plataforma.

**Criterios de aceptación:**

- [ ] CA1: La publicación o corrección genera un aviso para el alumno afectado con enlace autenticado y sin la nota en el correo.
- [ ] CA2: Un fallo permite reintentar sin duplicar avisos ya enviados y deja estado de entrega.
- [ ] CA3: El alumno puede consultar sus notas en la plataforma aunque el proveedor de correo falle.

**Dependencias:** H14, H17. **Decisiones previas:** Ninguna adicional.
**Prioridad:** Posterior. **Slicing:** Canal de comunicación.
**Responsable:** por asignar. **Revisor:** por asignar. **PR:** pendiente.
