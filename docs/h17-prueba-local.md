# H17 · Enviar evaluación a revisión en local

Rama: `feature/H17-enviar-evaluacion-revision`. Implementación local, pendiente de revisión e integración del equipo.

## Preparación

Con PostgreSQL iniciado y `apps/api/.env` configurado:

```sh
npm run db:migrar
npm run dev:api
# En otra terminal
npm run dev:web
```

Abrir http://localhost:5173. Usar un profesor o ayudante de prueba asignado a la sección (o administrador). El acceso local de desarrollo existente requiere que la cuenta esté habilitada.

## Recorrido

1. Seleccionar período y sección; abrir una evaluación en BORRADOR.
2. Ingresar una nota válida (1.0–7.0) o marcar ausencia para cada alumno.
3. Guardar notas y ausencias. Los cambios pendientes deben guardarse antes del envío.
4. Pulsar **Enviar a revisión**. El estado cambia a **En revisión** y la planilla queda en solo lectura.
5. Cerrar y reabrir: el estado persiste y se muestra la fecha de envío en la lista.
6. Comprobar que el alumno no puede consultar las notas en revisión.

El servidor rechaza el envío de filas pendientes, el reenvío de una evaluación ya enviada y la edición de notas/ausencias fuera de BORRADOR. Envió y guardado bloquean la misma fila de evaluación para serializar operaciones simultáneas. Autor y fecha se conservan en la evaluación y se registra el evento de auditoría.

API: `POST /api/calificaciones/evaluaciones/:id/enviar-revision`, cuerpo JSON `{}`.

Pruebas: `apps/api/test/h17-enviar-evaluacion-revision.spec.ts`. Configurar `TEST_DATABASE_URL` hacia una base exclusiva cuyo nombre termine en `_test`; ejecutar `npm run test:api`. Sin esa variable las pruebas PostgreSQL se omiten.

La devolución, corrección y publicación corresponden a H18–H20.
