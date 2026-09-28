const fs=require('fs');
const assert=require('assert');

const app=fs.readFileSync('dist/app.js','utf8');
const html=fs.readFileSync('dist/index.html','utf8');
const css=fs.readFileSync('dist/styles.css','utf8');
const gas=fs.readFileSync('google-apps-script/Code.gs','utf8');
const rootApp=fs.readFileSync('app.js','utf8');
const rootHtml=fs.readFileSync('index.html','utf8');
const rootCss=fs.readFileSync('styles.css','utf8');

assert.strictEqual(rootApp,app,'root/app.js y dist/app.js deben permanecer sincronizados');
assert.strictEqual(rootHtml,html,'root/index.html y dist/index.html deben permanecer sincronizados');
assert.strictEqual(rootCss,css,'root/styles.css y dist/styles.css deben permanecer sincronizados');

assert(app.includes("megaMode=modeKey==='mega'"),'Debe existir modo mega aislado');
assert(app.includes("megaMode?'megabootstrap':'bootstrap'"),'Los modos normales deben conservar bootstrap');
assert(app.includes("action:'megacreate'"),'MEGA debe crear con acción separada');
assert(app.includes("action:'megaupdate'"),'MEGA debe editar con acción separada');
assert(app.includes("action:'cancel'"),'MEGA debe cancelar');
assert(app.includes("action:'restore'"),'MEGA debe recuperar');
assert(app.includes("action:'purge'"),'MEGA debe permitir borrado definitivo');

assert(html.includes('id="megaPanel"'),'Debe existir panel MEGA');
assert(html.includes('id="megaChanges"'),'Debe existir feed de cambios');
assert(html.includes('id="megaCancelled"'),'Debe existir papelera MEGA');
assert(html.includes('id="confirmText"'),'Confirmación debe admitir mensajes específicos');
assert(html.includes('id="confirmDeleteButton"'),'Confirmación debe cambiar etiqueta según acción');

assert(css.includes("html[data-mega='1'] .app-shell"),'Layout MEGA debe estar aislado por atributo');
assert(gas.includes("const MEGA_ACCESS_KEY = 'CALENDAR_MEGA_ACCESS_TOKEN'"),'Token MEGA debe vivir en Script Properties');
assert(gas.includes("case 'megabootstrap'"),'Backend debe exponer bootstrap MEGA');
assert(gas.includes("case 'cancelled'"),'Backend debe exponer cancelados');
assert(gas.includes("function cancelEvent_"),'Backend debe cancelar sin borrar');
assert(gas.includes("function restoreEvent_"),'Backend debe recuperar');
assert(gas.includes("function purgeCancelledEvent_"),'Backend debe borrar definitivamente solo cancelados');
assert(gas.includes("function setupMegaAccess_"),'Debe existir inicialización segura del token');
assert(gas.includes('sheet.insertColumnsAfter(sheet.getMaxColumns(), missing)'),'MEGA debe ampliar EVENTOS de 16 a 18 columnas de forma segura');

assert(gas.includes("case 'bootstrap'"),'Bootstrap normal debe mantenerse');
assert(gas.includes("case 'delete'"),'CRUD normal debe mantenerse durante rollout aislado');

console.log('MEGALINK: aislamiento, historial, papelera y compatibilidad estática OK');
