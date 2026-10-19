# common

Piezas transversales de la API (Entrega 3, sección 3.4.1):

- guards/: AutenticacionGuard (401) y AutorizacionGuard (403)
- decorators/: @RequierePermiso(accion, recurso)
- interceptors/: ContextoInstitucionInterceptor (fija app.institucion_id para Row-Level Security)
