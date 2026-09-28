# API MEGA — Calendario Directivo PRISA Media

Estado: rama `feature/megalink-v1`. No desplegada todavía.

## Objetivo

Añadir funciones avanzadas exclusivamente para el MEGALINK sin cambiar el comportamiento de los accesos existentes.

## Inicialización única

Después de desplegar `google-apps-script/Code.gs`, ejecutar manualmente:

`prepareMegaInfrastructure_()`

La función:
- amplía EVENTOS de 16 a 18 columnas si hace falta;
- crea `Estado` y `Fecha_Cancelacion`;
- crea `HISTORIAL_CAMBIOS` si no existe;
- conserva el token existente o crea uno si todavía no existe;
- actualiza la versión de datos.

El token se guarda en Script Properties con la clave `CALENDAR_MEGA_ACCESS_TOKEN`. No debe guardarse en GitHub.

## GET existentes — sin cambios

- `?action=bootstrap`
- `?action=version`
- `?action=events`
- `?action=specialdays`
- `?action=config`

Estos endpoints mantienen el comportamiento de los links actuales.

## GET MEGA

### megabootstrap

`?action=megabootstrap&access=TOKEN`

Devuelve:
- eventos activos;
- días especiales;
- configuración;
- últimos 10 cambios;
- versión.

Usa caché por versión durante 90 segundos.

### cancelled

`?action=cancelled&access=TOKEN`

Devuelve únicamente eventos con `Estado=CANCELADO`, ordenados por fecha de cancelación descendente.

### megahealth

`?action=megahealth&access=TOKEN`

Diagnóstico de solo lectura:
- versión API;
- versión de datos;
- existencia de EVENTOS;
- cantidad física de columnas;
- confirmación del esquema MEGA;
- existencia y número de registros del historial.

## POST MEGA

Todos usan JSON y requieren `access`.

### Crear
`{"action":"megacreate","access":"TOKEN","event":{...}}`

### Modificar
`{"action":"megaupdate","access":"TOKEN","id":"UUID","event":{...}}`

No permite editar un evento cancelado.

### Cancelar
`{"action":"cancel","access":"TOKEN","id":"UUID"}`

No elimina la fila. Cambia:
- Estado → CANCELADO
- Fecha_Cancelacion → fecha/hora actual

### Recuperar
`{"action":"restore","access":"TOKEN","id":"UUID"}`

Cambia:
- Estado → ACTIVO
- Fecha_Cancelacion → vacío

Mantiene el resto de datos del evento.

### Eliminar definitivamente
`{"action":"purge","access":"TOKEN","id":"UUID"}`

Solo funciona si el evento ya está CANCELADO. En otro estado responde error.

## Historial

Hoja: `HISTORIAL_CAMBIOS`

Columnas:
- ID
- Evento_ID
- Evento_Nombre
- Accion
- FechaHora
- Cambios_JSON

Acciones registradas:
- CREADO
- MODIFICADO
- CANCELADO
- RECUPERADO

No se registra autor porque todavía no existe autenticación real.

Retención: máximo 500 cambios.

## Compatibilidad

Los accesos existentes continúan usando las primeras 16 columnas de EVENTOS y los endpoints actuales. Durante este rollout aislado, el estado de cancelación solo afecta la vista MEGA.
