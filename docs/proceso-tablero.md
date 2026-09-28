# Propuesta de proceso — pendiente de ratificación

Este tablero materializa el borrador de la Entrega 4. Las 38 historias comienzan en Refinamiento.

## Jerarquía y uso
Solo dos niveles de producto: **épica → historia de usuario**. Las tarjetas E1–E8 son índices de referencia; H01–H38 recorren el flujo. Los criterios y pasos técnicos van dentro de la historia, no como un tercer nivel. Esta lista de referencia no es un estado y no cuenta en los límites.

## Estados y políticas
1. **Refinamiento**: completar contexto, persona, criterios y decisiones. Sin límite.
2. **Listo (máx. 8)**: cumple DoR y tiene prioridad acordada. Se toma trabajo por capacidad disponible.
3. **En desarrollo (WIP 4)**: responsable asignado, rama vinculada y trabajo en curso; máximo una historia activa por persona.
4. **En revisión (WIP 2)**: PR abierto, comprobaciones aplicables ejecutadas y evidencia. Un revisor distinto del autor revisa.
5. **Validación (WIP 2)**: revisión aprobada e integración en develop; ejecutar criterios y regresiones en demostración antes de promover a main.
6. **Terminado**: cumple DoD, integrado en main y validado en demostración; tarjeta con PR, versión, evidencia, validador y fecha. Sin límite.

## Transiciones y excepciones
Flujo normal: Refinamiento → Listo → En desarrollo → En revisión → Validación → Terminado.
Si falla revisión o validación, regresar a En desarrollo y registrar el motivo; respetar capacidad antes de retomar. Si pierde DoR, volver a Refinamiento.
Una historia bloqueada permanece en su columna y sigue contando en WIP: indicar BLOQUEADA en el título, causa, responsable de desbloqueo y próxima revisión. La etiqueta Bloqueada es la convención prevista, pendiente de configurar. Desbloquear al resolver y registrar evidencia.
Revisar diariamente capacidad y bloqueos; priorizar terminar trabajo antes de iniciar más. Los límites escritos se controlan manualmente: no se ha configurado automatización de WIP.

