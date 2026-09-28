# Apps Script CI/CD

Este repositorio usa GitHub como fuente de verdad para el código de Google Apps Script.

## Flujo

`main` → pruebas → `clasp push` → nueva versión → actualización del deployment existente.

El workflow nunca crea un deployment nuevo. Antes de publicar verifica que `APPS_SCRIPT_DEPLOYMENT_ID` ya exista en el proyecto y, si no coincide, detiene el proceso.

## Secretos requeridos

Configurar en GitHub Actions:

- `CLASPRC_JSON`: contenido completo de `~/.clasprc.json` generado por `clasp login`.
- `CLASP_JSON`: configuración del proyecto, con forma:
  `{"scriptId":"SCRIPT_ID","rootDir":"google-apps-script"}`
- `APPS_SCRIPT_DEPLOYMENT_ID`: ID del deployment Web App de producción que ya existe.

Si falta cualquiera de estos valores, las pruebas se ejecutan pero el despliegue se omite de forma segura.

## Regla operativa

No editar código directamente en el editor de Apps Script. Los cambios deben hacerse en GitHub y llegar a Apps Script mediante este pipeline.

Para el primer enlace, habilitar la Apps Script API en la cuenta de Google y autenticar `clasp` una sola vez. Después, el refresh token se conserva únicamente como GitHub Secret.
