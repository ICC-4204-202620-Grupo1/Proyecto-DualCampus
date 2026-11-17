# H48 · Consultar indicadores institucionales

Rama `feature/H48-indicadores-institucionales`, creada desde `origin/develop`. Depende de H46 (distribución de notas) y H47 (asistencia agregada), ambas integradas. Sin migraciones nuevas.

## Qué muestra

`GET /api/reporteria/indicadores-institucionales?periodoId=<uuid>`, solo para el rol `DIRECTOR` de la institución activa. Por curso del período y para la institución: alumnos, promedio de notas publicadas, porcentaje de notas aprobadas (según la escala de aprobación de cada evaluación), porcentaje de asistencia y distribución de notas en los rangos de H46. En la web: menú **Indicadores institucionales**, con el período elegido en **Período de trabajo**.

## Reglas de anonimización (D2)

Implementadas en `apps/api/src/modules/reporteria/anonimizacion.ts`, como funciones puras.

- **Grupos pequeños (CA2).** Un curso con menos de 5 alumnos se oculta completo, incluido su tamaño. Además, cada indicador exige al menos 5 alumnos distintos que aporten datos: un curso de 6 en que solo 4 tienen notas no publica promedio.
- **Combinaciones reveladoras (CA2):**
  - *Unanimidad:* se oculta un valor que revelaría el resultado de cada alumno. Eso ocurre con 0 % o 100 % de aprobación o de asistencia, con todas las notas iguales o con todas las notas en un mismo rango.
  - *Celdas pequeñas:* un rango de la distribución con notas de 1 a 4 alumnos distintos se oculta.
  - *Supresión complementaria:* si queda una sola celda oculta, se oculta también la más pequeña de las visibles, para que no pueda deducirse restándola del total.
  - *Totales sin fugas:* el total institucional de cada indicador se calcula solo con datos ya publicados (cursos y celdas visibles). Lo suprimido nunca entra en una cifra visible, así que no puede deducirse restando el total menos los cursos publicados.
- **Sin identificadores (CA1).** La respuesta trae solo el código y el nombre del curso y cifras agregadas. Nunca incluye alumnos, secciones, evaluaciones ni identificadores internos.
- **Petición directa (CA3).** La anonimización ocurre en el servidor. Los parámetros extra (`alumnoId`, `seccionId`, `minimo`, `detalle`) se ignoran. El director recibe 403 en los reportes por sección (H46 y H47), en el detalle de secciones y en las notas.

Cada valor oculto lleva su `motivo`: `grupo_pequeno`, `unanime`, `complementaria` o `sin_datos`. La web lo muestra al pasar el cursor sobre «Oculto».

## Flujo local

1. Habilitar un director: `npm run usuario:habilitar -- director@dualcampus.test DIRECTOR "Universidad grande" "Director Demo"`.
2. Entrar con `/api/auth/dev-login?email=director@dualcampus.test` y abrir **Indicadores institucionales**.
3. Con un curso de menos de 5 alumnos, verificar «Oculto: menos de cinco alumnos». Con un curso de 5 o más alumnos con resultados variados, verificar las cifras.

## Verificación

`npm run build`, `npm run test:api` con `TEST_DATABASE_URL` y `git diff --check`. La suite `h48-indicadores-institucionales.spec.ts` cubre las reglas como funciones puras (siempre se ejecutan). Con `TEST_DATABASE_URL`, cubre además el endpoint sobre PostgreSQL con RLS: un curso de 12 alumnos con celdas pequeñas, uno de 3 y uno unánime, ausencia de nombres, correos e identificadores, parámetros forzados, acceso a reportes por sección y otros roles e instituciones.
