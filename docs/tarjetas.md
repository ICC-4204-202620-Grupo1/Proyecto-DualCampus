# Catálogo vigente de DualCampus

56 historias · 8 épicas · 29 MVP · 67 dependencias.

El avance comprobado se registra en [evidencia](entrega-5/evidencia.md).

### H01 · E1 · Ingresar con cuenta institucional [MVP]

Estado observado: **En revisión**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/5na2rMNR

Como Benjamin Alonso (profesor), quiero iniciar sesión con mi cuenta institucional, para acceder a DualCampus.

**Aceptación**

- [ ] CA1. Una cuenta institucional habilitada inicia sesión y conserva su identidad al recargar.
- [ ] CA2. Una cuenta no autorizada no obtiene una sesión.
- [ ] CA3. Una sesión vencida impide acceder a recursos protegidos.

**Predecesoras**

Sin historias predecesoras.

### H02 · E1 · Seleccionar institución activa [MVP]

Estado observado: **En revisión**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/slt9retL

Como Benjamin Alonso (profesor), quiero seleccionar una institución en la que tengo un rol, para trabajar en el contexto correcto.

**Aceptación**

- [ ] CA1. El selector muestra solamente instituciones autorizadas.
- [ ] CA2. La institución seleccionada queda visible y persiste durante la sesión.
- [ ] CA3. El cambio actualiza el contexto de las consultas posteriores.

**Predecesoras**

- [H01 · Ingresar con cuenta institucional](https://trello.com/c/5na2rMNR)

### H03 · E1 · Restringir acciones según el rol [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/tz5CwUMi

Como Rodolfo Ávila (administrador), quiero aplicar los permisos de cada rol, para proteger las acciones académicas.

**Aceptación**

- [ ] CA1. Cada rol dispone solo de las operaciones definidas para él.
- [ ] CA2. Una acción prohibida se rechaza también si se invoca directamente por API.
- [ ] CA3. El rechazo no modifica los datos.

**Predecesoras**

- [H02 · Seleccionar institución activa](https://trello.com/c/slt9retL)

### H04 · E1 · Aislar datos por institución y sección [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/Ti1basLl

Como Rodolfo Ávila (administrador), quiero limitar las consultas al ámbito autorizado, para evitar acceso a datos ajenos.

**Aceptación**

- [ ] CA1. Un profesor consulta solo las secciones que tiene asignadas.
- [ ] CA2. Un alumno consulta solo sus propios datos y cursos.
- [ ] CA3. Cambiar identificadores en la solicitud no expone otra institución ni sección.

**Predecesoras**

- [H03 · Restringir acciones según el rol](https://trello.com/c/tz5CwUMi)

### H05 · E2 · Crear un período académico [MVP]

Estado observado: **En revisión**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/zOdvgBcH

Como Rodolfo Ávila (administrador), quiero registrar las fechas y el nombre de un período, para preparar el semestre.

**Aceptación**

- [ ] CA1. Un período válido se guarda en su institución y puede volver a consultarse.
- [ ] CA2. Se rechazan fechas incoherentes y duplicados dentro de la institución.
- [ ] CA3. Se registra quién lo creó.

**Predecesoras**

- [H04 · Aislar datos por institución y sección](https://trello.com/c/Ti1basLl)

### H06 · E2 · Registrar un curso [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/9ib0lftY

Como Rodolfo Ávila (administrador), quiero crear un curso en un período, para organizar la oferta académica.

**Aceptación**

- [ ] CA1. El curso queda asociado al período e institución seleccionados.
- [ ] CA2. Se rechaza un código duplicado en el mismo ámbito.
- [ ] CA3. La lista del período muestra el nuevo curso.

**Predecesoras**

- [H05 · Crear un período académico](https://trello.com/c/zOdvgBcH)

### H07 · E2 · Crear una sección de curso [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/vOot6mky

Como Rodolfo Ávila (administrador), quiero crear una sección de un curso existente, para distribuir sus grupos docentes.

**Aceptación**

- [ ] CA1. La sección queda vinculada al curso y período correctos.
- [ ] CA2. Se rechaza una referencia a un curso de otra institución.
- [ ] CA3. La sección aparece al consultar el curso.

**Predecesoras**

- [H06 · Registrar un curso](https://trello.com/c/9ib0lftY)

### H08 · E2 · Asignar profesor a una sección [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/45vqPEPZ

Como Rodolfo Ávila (administrador), quiero asignar un profesor habilitado, para dejar responsable la sección.

**Aceptación**

- [ ] CA1. La sección muestra al profesor asignado.
- [ ] CA2. No se acepta un usuario sin rol docente en esa institución.
- [ ] CA3. El profesor puede consultar su sección tras la asignación.

**Predecesoras**

- [H07 · Crear una sección de curso](https://trello.com/c/vOot6mky)

### H09 · E2 · Asignar ayudantes a una sección [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/Gm2OO42q

Como Rodolfo Ávila (administrador), quiero asignar ayudantes habilitados, para permitirles apoyar al profesor.

**Aceptación**

- [ ] CA1. La sección muestra sus ayudantes asignados.
- [ ] CA2. Un usuario sin rol local se rechaza.
- [ ] CA3. La modificación registra autor y fecha.

**Predecesoras**

- [H08 · Asignar profesor a una sección](https://trello.com/c/45vqPEPZ)

### H10 · E2 · Validar una nómina antes de cargarla [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/K5Z8BJ63

Como Rodolfo Ávila (administrador), quiero revisar la nómina oficial recibida, para detectar filas incorrectas.

**Aceptación**

- [ ] CA1. La vista previa identifica alumnos, sección y cantidad de filas.
- [ ] CA2. Cada fila inválida muestra el motivo sin modificar la nómina vigente.
- [ ] CA3. Una nómina de otra institución no se acepta.

**Predecesoras**

- [H07 · Crear una sección de curso](https://trello.com/c/vOot6mky)

### H11 · E2 · Confirmar inscripción de alumnos [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/qPP83Rtd

Como Rodolfo Ávila (administrador), quiero confirmar una nómina validada, para mantener a los alumnos activos de la sección.

**Aceptación**

- [ ] CA1. Los alumnos válidos quedan inscritos en la sección.
- [ ] CA2. Repetir la misma carga no crea inscripciones duplicadas.
- [ ] CA3. El docente puede consultar el total de inscritos.

**Predecesoras**

- [H10 · Validar una nómina antes de cargarla](https://trello.com/c/K5Z8BJ63)

### H12 · E2 · Registrar un retiro oficial

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/v4RbzD3n

Como Rodolfo Ávila (administrador), quiero registrar el retiro informado de un alumno, para actualizar la nómina sin perder antecedentes.

**Aceptación**

- [ ] CA1. Se exige alumno, sección, fecha y referencia de la comunicación oficial.
- [ ] CA2. El alumno deja de figurar como activo y se conservan registros anteriores.
- [ ] CA3. La operación registra responsable y fecha.

**Predecesoras**

- [H11 · Confirmar inscripción de alumnos](https://trello.com/c/qPP83Rtd)

### H13 · E2 · Consultar calendario del período

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/BwGUry5T

Como Tomás Alcaíno (alumno), quiero consultar las fechas del período activo, para organizar mis actividades.

**Aceptación**

- [ ] CA1. La vista presenta inicio y término del período de la institución activa.
- [ ] CA2. Cambiar de período actualiza las fechas sin mezclar instituciones.
- [ ] CA3. Una institución sin calendario muestra Sin datos.

**Predecesoras**

- [H05 · Crear un período académico](https://trello.com/c/zOdvgBcH)

### H14 · E3 · Crear una evaluación presencial [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/Q2DPoorX

Como Javiera Ossandón (profesora), quiero registrar una evaluación de mi sección, para organizar su calificación.

**Aceptación**

- [ ] CA1. Nombre y fecha válidos crean una evaluación en la sección.
- [ ] CA2. El ayudante no puede crearla.
- [ ] CA3. La evaluación usa la escala definida para la institución.

**Predecesoras**

- [H09 · Asignar ayudantes a una sección](https://trello.com/c/Gm2OO42q)
- [H11 · Confirmar inscripción de alumnos](https://trello.com/c/qPP83Rtd)

### H15 · E3 · Ingresar notas en borrador [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/pkndAe3f

Como Diego Riquelme (ayudante), quiero guardar notas parciales de una evaluación, para evitar pérdida de digitación.

**Aceptación**

- [ ] CA1. Una nota válida se guarda y se recupera al reabrir.
- [ ] CA2. Un valor fuera de escala no reemplaza la última nota válida.
- [ ] CA3. El alumno no ve valores en el borrador.

**Predecesoras**

- [H14 · Crear una evaluación presencial](https://trello.com/c/Q2DPoorX)

### H16 · E3 · Registrar ausencias en borrador [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/iM5a6Z87

Como Diego Riquelme (ayudante), quiero marcar explícitamente a un alumno ausente, para distinguir ausencia de nota cero.

**Aceptación**

- [ ] CA1. La ausencia se guarda como un estado distinto de cero.
- [ ] CA2. El profesor ve la marca al revisar el borrador.
- [ ] CA3. Solo profesor o ayudante asignado pueden modificarla.

**Predecesoras**

- [H15 · Ingresar notas en borrador](https://trello.com/c/pkndAe3f)

### H17 · E3 · Enviar evaluación a revisión [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/FLz2acBM

Como Diego Riquelme (ayudante), quiero enviar un borrador completo al profesor, para pedir su aprobación.

**Aceptación**

- [ ] CA1. Todas las filas deben tener nota válida o ausencia explícita.
- [ ] CA2. El envío cambia el estado a "En revisión” y bloquea nuevas ediciones.
- [ ] CA3. Se conservan autor y fecha del envío.

**Predecesoras**

- [H15 · Ingresar notas en borrador](https://trello.com/c/pkndAe3f)
- [H16 · Registrar ausencias en borrador](https://trello.com/c/iM5a6Z87)

### H18 · E3 · Devolver evaluación observada [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/mm4Hxtdu

Como Javiera Ossandón (profesora), quiero devolver una evaluación con comentarios, para solicitar su corrección.

**Aceptación**

- [ ] CA1. La devolución exige un comentario y cambia el estado a Devuelta.
- [ ] CA2. El ayudante asignado ve la observación y puede corregir.
- [ ] CA3. Las notas siguen ocultas al alumnado.

**Predecesoras**

- [H17 · Enviar evaluación a revisión](https://trello.com/c/FLz2acBM)

### H19 · E3 · Reenviar evaluación corregida [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/2n2jOSHg

Como Diego Riquelme (ayudante), quiero reenviar la evaluación de vuelta, para dejarla lista para otra revisión.

**Aceptación**

- [ ] CA1. Se verifica otra vez que todas las filas estén resueltas.
- [ ] CA2. El reenvío cambia el estado a "En revisión” y bloquea la edición.
- [ ] CA3. Quedan visibles la observación anterior y fecha del reenvío.

**Predecesoras**

- [H18 · Devolver evaluación observada](https://trello.com/c/mm4Hxtdu)

### H20 · E3 · Publicar notas aprobadas [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/C4WdFt31

Como Javiera Ossandón (profesora), quiero aprobar una evaluación revisada, para comunicar resultados oficiales.

**Aceptación**

- [ ] CA1. Solo el profesor asignado puede publicar una evaluación En revisión.
- [ ] CA2. La publicación deja autor y fecha y cambia el estado a Publicada.
- [ ] CA3. Un ayudante o docente no asignado no puede ejecutar la operación.

**Predecesoras**

- [H17 · Enviar evaluación a revisión](https://trello.com/c/FLz2acBM)

### H21 · E3 · Consultar notas propias publicadas [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/YVSAOw4X

Como Tomás Alcaíno (alumno), quiero ver mis notas publicadas, para conocer mis resultados.

**Aceptación**

- [ ] CA1. Se muestran evaluación y nota de mis cursos publicados.
- [ ] CA2. Borradores y evaluaciones en revisión o devueltas no se exponen.
- [ ] CA3. Solicitar el identificador de otro alumno no muestra sus notas.

**Predecesoras**

- [H20 · Publicar notas aprobadas](https://trello.com/c/C4WdFt31)

### H22 · E3 · Corregir una nota publicada

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/BLfsG4iJ

Como Rodolfo Ávila (administrador), quiero modificar una nota por solicitud formal, para resolver un error documentado.

**Aceptación**

- [ ] CA1. Se exige valor válido, motivo y referencia de la solicitud.
- [ ] CA2. Se conservan valor previo, valor nuevo, autor y fecha.
- [ ] CA3. El alumno ve el valor vigente; profesor y ayudante no pueden corregir por esta vía.

**Predecesoras**

- [H20 · Publicar notas aprobadas](https://trello.com/c/C4WdFt31)

### H23 · E3 · Consultar auditoría de calificaciones [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/GDqQSw6C

Como Rodolfo Ávila (administrador), quiero consultar eventos de una evaluación, para revisar quién actuó y cuándo.

**Aceptación**

- [ ] CA1. Se listan creación, envío, devolución y publicación con autor y fecha.
- [ ] CA2. Los eventos existentes no se pueden editar ni eliminar desde la consulta.
- [ ] CA3. Una corrección posterior añade su valor previo, nuevo y motivo al registro.

**Predecesoras**

- [H20 · Publicar notas aprobadas](https://trello.com/c/C4WdFt31)

### H24 · E4 · Publicar un material de curso [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/pcuW5Kai

Como Javiera Ossandón (profesora), quiero subir un documento con título a mi sección, para compartirlo con mis alumnos.

**Aceptación**

- [ ] CA1. El archivo permitido aparece solo después de almacenarse correctamente.
- [ ] CA2. Un archivo fuera de límites muestra el motivo del rechazo.
- [ ] CA3. Solo el profesor asignado puede publicarlo.

**Predecesoras**

- [H09 · Asignar ayudantes a una sección](https://trello.com/c/Gm2OO42q)

### H25 · E4 · Descargar materiales autorizados [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/eux5cgqp

Como Tomás Alcaíno (alumno), quiero descargar material de mis cursos, para estudiar su contenido.

**Aceptación**

- [ ] CA1. El alumno inscrito descarga el archivo correspondiente al título.
- [ ] CA2. Profesor y ayudante asignados también pueden consultarlo.
- [ ] CA3. Un usuario ajeno no descarga el archivo aunque conozca su enlace.

**Predecesoras**

- [H11 · Confirmar inscripción de alumnos](https://trello.com/c/qPP83Rtd)
- [H24 · Publicar un material de curso](https://trello.com/c/pcuW5Kai)

### H26 · E4 · Reutilizar material entre períodos

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/2NNtgPZa

Como Benjamin Alonso (profesor), quiero copiar un material anterior a otra sección autorizada, para preparar el siguiente semestre.

**Aceptación**

- [ ] CA1. Se seleccionan secciones de origen y destino de la misma institución.
- [ ] CA2. La copia se revisa antes de publicarse en destino.
- [ ] CA3. Editar la copia no altera el material original.

**Predecesoras**

- [H24 · Publicar un material de curso](https://trello.com/c/pcuW5Kai)

### H27 · E4 · Crear una actividad de entrega [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/UaCYtNSb

Como Javiera Ossandón (profesora), quiero definir una actividad para recibir un informe, para abrir una entrega sin necesitar una evaluación de notas.

**Aceptación**

- [ ] CA1. Título e instrucciones crean una actividad en la sección.
- [ ] CA2. El alumno inscrito consulta las instrucciones.
- [ ] CA3. La actividad no requiere una evaluación presencial previa.

**Predecesoras**

- [H09 · Asignar ayudantes a una sección](https://trello.com/c/Gm2OO42q)

### H28 · E4 · Configurar plazo y formatos de entrega [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/6aN3JxDF

Como Javiera Ossandón (profesora), quiero definir apertura, cierre y tipos de archivo, para establecer condiciones claras.

**Aceptación**

- [ ] CA1. Se guardan fecha y hora de apertura y cierre, formato y tamaño máximo.
- [ ] CA2. Un cierre anterior a la apertura se rechaza.
- [ ] CA3. El alumno ve las condiciones antes de subir un archivo.

**Predecesoras**

- [H27 · Crear una actividad de entrega](https://trello.com/c/UaCYtNSb)

### H29 · E4 · Enviar un archivo de actividad [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/clwfvU65

Como Tomás Alcaíno (alumno), quiero subir mi informe dentro del plazo, para entregar mi trabajo.

**Aceptación**

- [ ] CA1. Un archivo permitido queda asociado a mi actividad y cuenta.
- [ ] CA2. Un archivo inválido o fuera de plazo se rechaza con motivo.
- [ ] CA3. Una falla de carga no sustituye una entrega previamente confirmada.

**Predecesoras**

- [H11 · Confirmar inscripción de alumnos](https://trello.com/c/qPP83Rtd)
- [H28 · Configurar plazo y formatos de entrega](https://trello.com/c/6aN3JxDF)

### H30 · E4 · Obtener comprobante de entrega [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/PzQjRAq0

Como Tomás Alcaíno (alumno), quiero ver la confirmación del archivo recibido, para tener evidencia de la entrega.

**Aceptación**

- [ ] CA1. Solo una entrega almacenada genera comprobante.
- [ ] CA2. El comprobante muestra archivo, actividad y fecha de recepción.
- [ ] CA3. Al reabrir la actividad puedo consultar el mismo comprobante.

**Predecesoras**

- [H29 · Enviar un archivo de actividad](https://trello.com/c/clwfvU65)

### H31 · E4 · Consultar informes recibidos [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/CzzqL8z6

Como Javiera Ossandón (profesora), quiero ver los informes de mi sección, para organizar su revisión.

**Aceptación**

- [ ] CA1. Profesor y ayudante asignados ven autor, archivo y fecha.
- [ ] CA2. Una sección sin entregas muestra ese estado.
- [ ] CA3. Un docente no asignado no consulta la lista.

**Predecesoras**

- [H29 · Enviar un archivo de actividad](https://trello.com/c/clwfvU65)

### H32 · E4 · Descargar un informe recibido [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/DINnm5ys

Como Javiera Ossandón (profesora), quiero descargar un archivo entregado, para revisar su contenido.

**Aceptación**

- [ ] CA1. El archivo descargado corresponde a la entrega seleccionada.
- [ ] CA2. El alumno puede descargar solo su propia entrega.
- [ ] CA3. Ni otro alumno ni un usuario ajeno obtienen el archivo.

**Predecesoras**

- [H31 · Consultar informes recibidos](https://trello.com/c/CzzqL8z6)

### H33 · E4 · Reintentar una carga interrumpida

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/0X0Yudh6

Como Tomás Alcaíno (alumno), quiero reintentar el envío fallido, para completar mi entrega sin duplicarla.

**Aceptación**

- [ ] CA1. Un reintento exitoso deja una sola entrega confirmada.
- [ ] CA2. El fallo muestra una causa y no emite comprobante.
- [ ] CA3. El reintento respeta el plazo vigente o una reapertura autorizada.

**Predecesoras**

- [H29 · Enviar un archivo de actividad](https://trello.com/c/clwfvU65)

### H34 · E5 · Crear un registro de clase

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/Vk7is5RK

Como Javiera Ossandón (profesora), quiero registrar una sesión con fecha, para preparar el control de asistencia.

**Aceptación**

- [ ] CA1. La clase queda asociada a mi sección y fecha.
- [ ] CA2. Un usuario no asignado no puede crearla.
- [ ] CA3. Una clase duplicada según la regla acordada se rechaza.

**Predecesoras**

- [H09 · Asignar ayudantes a una sección](https://trello.com/c/Gm2OO42q)
- [H11 · Confirmar inscripción de alumnos](https://trello.com/c/qPP83Rtd)

### H35 · E5 · Marcar asistencia del alumnado

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/eWBLagb7

Como Javiera Ossandón (profesora), quiero guardar presentes y ausentes de una clase, para dejar constancia de participación.

**Aceptación**

- [ ] CA1. Cada alumno activo tiene una marca guardada.
- [ ] CA2. Las marcas se recuperan al reabrir la clase.
- [ ] CA3. Quedan registrados autor y fecha.

**Predecesoras**

- [H34 · Crear un registro de clase](https://trello.com/c/Vk7is5RK)

### H36 · E5 · Consultar asistencia propia

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/VRwExBfG

Como Tomás Alcaíno (alumno), quiero ver mis marcas de asistencia, para detectar diferencias.

**Aceptación**

- [ ] CA1. Veo mis clases y estados sin datos de compañeros.
- [ ] CA2. Con cero clases se muestra Sin datos.
- [ ] CA3. El resumen indica presentes y clases consideradas.

**Predecesoras**

- [H35 · Marcar asistencia del alumnado](https://trello.com/c/eWBLagb7)

### H37 · E5 · Corregir una marca de asistencia

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/2Nc1JCm6

Como Javiera Ossandón (profesora), quiero corregir una marca con motivo, para reparar un error.

**Aceptación**

- [ ] CA1. Se exige motivo y autorización para modificar la marca.
- [ ] CA2. Se conservan el estado anterior, nuevo, autor y fecha.
- [ ] CA3. La consulta individual usa la marca vigente.

**Predecesoras**

- [H35 · Marcar asistencia del alumnado](https://trello.com/c/eWBLagb7)

### H38 · E5 · Calcular proporción de asistencia

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/lPRTop5Z

Como Tomás Alcaíno (alumno), quiero ver mi proporción de presencia, para entender mi registro.

**Aceptación**

- [ ] CA1. El cálculo usa las clases válidas y marcas corregidas.
- [ ] CA2. Se muestran numerador y denominador.
- [ ] CA3. Con denominador cero no se inventa un porcentaje.

**Predecesoras**

- [H36 · Consultar asistencia propia](https://trello.com/c/VRwExBfG)
- [H37 · Corregir una marca de asistencia](https://trello.com/c/2Nc1JCm6)

### H39 · E6 · Consolidar calificaciones por período [MVP]

Estado observado: **Por hacer**. Prioridad: **MVP**.

Tarjeta: https://trello.com/c/ypTzZ9bx

Como Tomás Alcaíno (alumno), quiero ver mis resultados publicados agrupados por período, para revisar mi trayectoria.

**Aceptación**

- [ ] CA1. Se muestran períodos, asignaturas y notas publicadas propias.
- [ ] CA2. Un período sin registros muestra Sin datos.
- [ ] CA3. Los resultados de otra institución no se mezclan.

**Predecesoras**

- [H21 · Consultar notas propias publicadas](https://trello.com/c/YVSAOw4X)
- [H05 · Crear un período académico](https://trello.com/c/zOdvgBcH)

### H40 · E6 · Validar lote de notas históricas

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/9LAiTa48

Como Rodolfo Ávila (administrador), quiero previsualizar registros históricos, para detectar errores antes de importarlos.

**Aceptación**

- [ ] CA1. La vista previa identifica identidad, curso, escala y filas inválidas.
- [ ] CA2. Cada rechazo informa una causa sin escribir registros.
- [ ] CA3. Se muestran totales de control del lote.

**Predecesoras**

- [H07 · Crear una sección de curso](https://trello.com/c/vOot6mky)

### H41 · E6 · Confirmar importación histórica

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/EJSCFMlW

Como Rodolfo Ávila (administrador), quiero incorporar un lote validado, para centralizar antecedentes anteriores.

**Aceptación**

- [ ] CA1. Solo se confirma un lote validado y conciliado.
- [ ] CA2. El lote guarda identificador, responsable y totales.
- [ ] CA3. Confirmar el mismo lote otra vez no duplica notas.

**Predecesoras**

- [H40 · Validar lote de notas históricas](https://trello.com/c/9LAiTa48)

### H42 · E6 · Mostrar notas históricas importadas

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/uwy1SOg2

Como Tomás Alcaíno (alumno), quiero ver notas importadas en el período correspondiente, para consultar mis antecedentes.

**Aceptación**

- [ ] CA1. Las notas confirmadas aparecen con su origen identificado.
- [ ] CA2. No se muestran lotes rechazados o revertidos.
- [ ] CA3. El alumno no obtiene registros ajenos.

**Predecesoras**

- [H39 · Consolidar calificaciones por período](https://trello.com/c/ypTzZ9bx)
- [H41 · Confirmar importación histórica](https://trello.com/c/EJSCFMlW)

### H43 · E6 · Vincular una cuenta personal verificada

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/qNHaCbo2

Como Tomás Alcaíno (alumno), quiero asociar una cuenta personal antes del egreso, para preparar la consulta posterior.

**Aceptación**

- [ ] CA1. La vinculación requiere sesión vigente y verificar la propiedad de la cuenta.
- [ ] CA2. Una cuenta ya asociada a otra persona se rechaza.
- [ ] CA3. La asociación persiste y se puede consultar desde mi perfil.

**Predecesoras**

- [H04 · Aislar datos por institución y sección](https://trello.com/c/Ti1basLl)

### H44 · E6 · Acceder al historial tras el egreso

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/JTmZ1q1w

Como Tomás Alcaíno (egresado), quiero ingresar con la cuenta personal vinculada, para consultar mis antecedentes tras perder la institucional.

**Aceptación**

- [ ] CA1. La cuenta verificada identifica al mismo alumno aunque la institucional esté inactiva.
- [ ] CA2. El acceso permite solo consulta de su historial.
- [ ] CA3. Sin vinculación se informa el canal de asistencia.

**Predecesoras**

- [H39 · Consolidar calificaciones por período](https://trello.com/c/ypTzZ9bx)
- [H43 · Vincular una cuenta personal verificada](https://trello.com/c/qNHaCbo2)

### H45 · E6 · Revertir un lote histórico

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/CbFx5HM4

Como Rodolfo Ávila (administrador), quiero revertir una importación errónea, para conservar un historial correcto.

**Aceptación**

- [ ] CA1. La reversión afecta solo los registros del lote seleccionado.
- [ ] CA2. No altera notas posteriores independientes.
- [ ] CA3. Se registra responsable, fecha y motivo.

**Predecesoras**

- [H41 · Confirmar importación histórica](https://trello.com/c/EJSCFMlW)

### H46 · E7 · Consultar distribución de notas por sección

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/yRubVn9V

Como Benjamin Alonso (profesor), quiero ver el rendimiento de mi sección, para identificar necesidades de apoyo.

**Aceptación**

- [ ] CA1. La distribución usa solo notas publicadas e indica cantidad y período.
- [ ] CA2. Una sección sin datos lo informa explícitamente.
- [ ] CA3. Un docente no asignado no ve la distribución.

**Predecesoras**

- [H20 · Publicar notas aprobadas](https://trello.com/c/C4WdFt31)

### H47 · E7 · Consultar asistencia agregada por sección

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/TLbKWEiP

Como Benjamin Alonso (profesor), quiero ver asistencia agregada de mi sección, para identificar patrones.

**Aceptación**

- [ ] CA1. La vista muestra período, presentes y clases consideradas.
- [ ] CA2. Usa marcas corregidas sin inventar datos faltantes.
- [ ] CA3. Un docente no asignado no puede consultarla.

**Predecesoras**

- [H38 · Calcular proporción de asistencia](https://trello.com/c/lPRTop5Z)

### H48 · E7 · Consultar indicadores institucionales

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/lOuYn6mj

Como Rodrigo Manríquez (director), quiero ver indicadores agregados de mi institución, para evaluar su desempeño.

**Aceptación**

- [ ] CA1. La vista excluye nombres e identificadores individuales.
- [ ] CA2. Suprime grupos con menos de cinco alumnos y combinaciones reveladoras.
- [ ] CA3. Una petición directa tampoco entrega el detalle personal.

**Predecesoras**

- [H46 · Consultar distribución de notas por sección](https://trello.com/c/yRubVn9V)
- [H47 · Consultar asistencia agregada por sección](https://trello.com/c/TLbKWEiP)

### H49 · E7 · Filtrar reportes por facultad y período

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/fslbrEdB

Como Rodrigo Manríquez (director), quiero aplicar filtros al reporte agregado, para comparar contextos autorizados.

**Aceptación**

- [ ] CA1. Filtros y totales indican facultad, período y denominadores.
- [ ] CA2. La supresión de grupos pequeños se mantiene tras filtrar.
- [ ] CA3. Los filtros no mezclan instituciones.

**Predecesoras**

- [H48 · Consultar indicadores institucionales](https://trello.com/c/lOuYn6mj)

### H50 · E7 · Exportar un reporte agregado

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/FF9zQExV

Como Rodrigo Manríquez (director), quiero descargar el reporte visible, para compartir indicadores autorizados.

**Aceptación**

- [ ] CA1. El archivo coincide con filtros y datos visibles e indica fecha.
- [ ] CA2. La exportación conserva supresiones y carece de identificadores.
- [ ] CA3. Sin permiso vigente se deniega la descarga.

**Predecesoras**

- [H49 · Filtrar reportes por facultad y período](https://trello.com/c/fslbrEdB)

### H51 · E7 · Programar un reporte periódico

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/R1Ke1H6y

Como Rodrigo Manríquez (director), quiero guardar frecuencia y destino institucional, para recibir el reporte actualizado.

**Aceptación**

- [ ] CA1. Se guardan filtros, frecuencia y destino autorizado.
- [ ] CA2. Cada ejecución revalida permisos y privacidad y registra estado.
- [ ] CA3. La programación puede cancelarse; un fallo no figura como éxito.

**Predecesoras**

- [H50 · Exportar un reporte agregado](https://trello.com/c/FF9zQExV)

### H52 · E8 · Publicar anuncio de sección

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/bzAsy7fz

Como Javiera Ossandón (profesora), quiero publicar un anuncio en mi sección, para comunicar indicaciones.

**Aceptación**

- [ ] CA1. Título y mensaje aparecen en la sección con autor y fecha.
- [ ] CA2. Solo el profesor asignado puede publicar.
- [ ] CA3. El anuncio no aparece en otra institución.

**Predecesoras**

- [H09 · Asignar ayudantes a una sección](https://trello.com/c/Gm2OO42q)

### H53 · E8 · Consultar anuncios del curso

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/VFodS422

Como Tomás Alcaíno (alumno), quiero leer anuncios de mis secciones, para conocer indicaciones del profesor.

**Aceptación**

- [ ] CA1. Los anuncios se ordenan por fecha con título y autor.
- [ ] CA2. No se ven anuncios de secciones ajenas.
- [ ] CA3. Sin anuncios se muestra un estado vacío claro.

**Predecesoras**

- [H11 · Confirmar inscripción de alumnos](https://trello.com/c/qPP83Rtd)
- [H52 · Publicar anuncio de sección](https://trello.com/c/bzAsy7fz)

### H54 · E8 · Avisar por correo la publicación de notas

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/y7sWAzfF

Como Tomás Alcaíno (alumno), quiero recibir un aviso de publicación, para saber cuándo consultar mis notas.

**Aceptación**

- [ ] CA1. La publicación genera un aviso solo para el alumno afectado.
- [ ] CA2. El correo incluye enlace autenticado sin revelar la nota.
- [ ] CA3. El fallo del correo no impide consultar la nota en la plataforma.

**Predecesoras**

- [H20 · Publicar notas aprobadas](https://trello.com/c/C4WdFt31)

### H55 · E8 · Avisar por correo una corrección de nota

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/aILyotnh

Como Tomás Alcaíno (alumno), quiero recibir un aviso de corrección, para revisar el resultado vigente.

**Aceptación**

- [ ] CA1. Solo una corrección confirmada genera aviso al afectado.
- [ ] CA2. El mensaje no contiene valor de la nota.
- [ ] CA3. La corrección permanece visible aunque falle el envío.

**Predecesoras**

- [H22 · Corregir una nota publicada](https://trello.com/c/BLfsG4iJ)

### H56 · E8 · Consultar estado de avisos enviados

Estado observado: **Por hacer**. Prioridad: **Posterior**.

Tarjeta: https://trello.com/c/apaomCYU

Como Rodolfo Ávila (administrador), quiero revisar si los avisos se entregaron, para detectar fallos de comunicación.

**Aceptación**

- [ ] CA1. Se muestran evento, destinatario y estado sin exponer notas.
- [ ] CA2. Un aviso fallido puede reintentarse sin duplicar los ya enviados.
- [ ] CA3. Cada intento conserva fecha y resultado.

**Predecesoras**

- [H54 · Avisar por correo la publicación de notas](https://trello.com/c/y7sWAzfF)
- [H55 · Avisar por correo una corrección de nota](https://trello.com/c/aILyotnh)
