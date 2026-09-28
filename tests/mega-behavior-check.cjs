const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
const headers = ['ID','Tipo','Nombre','Sistema','Fecha_Inicio','Fecha_Fin','Hora_Inicio','Hora_Fin','Talentos','Ejecutivos','Comercializable','Disponibilidad','Descripcion','Enlace','Fecha_Creacion','Fecha_Modificacion','Estado','Fecha_Cancelacion'];
const row = (id,status='') => [id,'PRISA Inspira','QA FINAL MEGALINK','Caracol',new Date(2026,8,28),'','','','','','No','','','','','',status,''];
function fixture() {
  const rows = [headers, row('legacy'), row('active','ACTIVO'), row('cancelled','CANCELADO')];
  const logs = [['ID','Evento_ID','Evento_Nombre','Accion','FechaHora','Cambios_JSON']];
  const props = new Map([['CALENDAR_MEGA_ACCESS_TOKEN','fixture-token'],['CALENDAR_DATA_VERSION','1000']]);
  let rejectHistory = false;
  function sheet(values) {return {
    getLastRow:()=>values.length, getMaxRows:()=>1000, getMaxColumns:()=>18,
    getRange(r,c,n=1,w=1){return {
      getValues:()=>values.slice(r-1,r-1+n).map(x=>x.slice(c-1,c-1+w)),
      getDisplayValues:()=>values.slice(r-1,r-1+n).map(x=>x.slice(c-1,c-1+w).map(String)),
      getValue:()=>values[r-1][c-1],getDisplayValue:()=>String(values[r-1][c-1]),
      setValues:data=>{data.forEach((x,i)=>{if(!values[r-1+i])values[r-1+i]=Array(18).fill('');x.forEach((v,j)=>values[r-1+i][c-1+j]=v)});return this}
    }},
    appendRow:x=>{if(rejectHistory&&values===logs)throw Error('history failure'); values.push(x)},
    deleteRow:r=>values.splice(r-1,1),deleteRows:(r,n)=>values.splice(r-1,n),
    insertRowBefore:r=>values.splice(r-1,0,Array(18).fill('')),
    insertColumnsAfter(){throw Error('Unexpected schema change')}
  }}
  const sheets={EVENTOS:sheet(rows),HISTORIAL_CAMBIOS:sheet(logs)};
  const context={console:{...console,error(){}},Date,JSON,Math,Utilities:{getUuid:()=>`qa-${Math.random()}`,formatDate:(d,tz,f)=>f==='yyyy-MM-dd'?d.toISOString().slice(0,10):d.toISOString().slice(0,19).replace('T',' ')},
    SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets[n]})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},
    CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})},
    ContentService:{MimeType:{JSON:'JSON'},createTextOutput:body=>({setMimeType(){return this},body})}
  };
  vm.createContext(context);vm.runInContext(code,context);vm.runInContext("getConfig_ = () => ({ tiposEvento: ['PRISA Inspira'], sistemas: ['Caracol'], talentos: [], ejecutivos: [], disponibilidad: [] })",context);
  const post=(action,id,access='fixture-token',event)=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({action,id,access,event})}}).body);
  return {context,rows,logs,props,post,failHistory:()=>{rejectHistory=true}};
}
{
 const f=fixture();const ids=f.context.getEvents_().map(x=>x.ID);assert.deepEqual(Array.from(ids),['legacy','active']);
 const initial=f.props.get('CALENDAR_DATA_VERSION');
 assert.equal(f.post('cancel','legacy','wrong').ok,false);assert.equal(f.props.get('CALENDAR_DATA_VERSION'),initial);
 assert.equal(f.post('purge','active').ok,false);
 assert.equal(f.post('cancel','active').ok,true);assert.equal(f.rows[2][16],'CANCELADO');assert.equal(f.logs.length,2);
 const v=f.props.get('CALENDAR_DATA_VERSION');assert.equal(f.post('delete','active').ok,true);assert.equal(f.logs.length,2);assert.equal(f.props.get('CALENDAR_DATA_VERSION'),v);
 assert.equal(f.post('update','active').ok,false);assert.equal(f.post('restore','active').ok,true);assert.equal(f.rows[2][16],'ACTIVO');
 assert.equal(f.post('restore','active').ok,false);assert.equal(f.post('delete','active').ok,true);assert.equal(f.rows[2][16],'CANCELADO');
 assert.equal(f.logs.at(-1)[3],'CANCELADO');assert.equal(f.post('purge','active').ok,true);assert.equal(f.rows.some(x=>x[0]==='active'),false);
}
{
 const f=fixture();f.failHistory();const before=f.props.get('CALENDAR_DATA_VERSION');
 assert.equal(f.post('cancel','active').ok,false);assert.equal(f.rows[2][16],'ACTIVO');assert.equal(f.props.get('CALENDAR_DATA_VERSION'),before);
}
{
 const f=fixture(), e={Tipo:'PRISA Inspira',Nombre:'QA FINAL MEGALINK',Sistema:'Caracol',Fecha_Inicio:'2026-09-28',Comercializable:'No'};
 const made=f.post('megacreate',null,'fixture-token',e);assert.equal(made.ok,true,JSON.stringify(made));
 const id=made.data.event.ID;assert.equal(made.data.event.Estado,'ACTIVO');assert.equal(made.data.event.Fecha_Cancelacion,'');
 assert.equal(f.rows.some(x=>x[0]===id),true);assert.equal(f.logs.at(-1)[3],'CREADO');
 const createChanges=JSON.parse(f.logs.at(-1)[5]);assert.equal(createChanges.Tipo.despues,'PRISA Inspira');assert.equal(createChanges.Nombre.despues,'QA FINAL MEGALINK');assert.equal(createChanges.Fecha_Inicio.despues,'2026-09-28');
 const v=f.props.get('CALENDAR_DATA_VERSION');
 const same=f.post('megaupdate',id,'fixture-token',e);assert.equal(same.ok,true,JSON.stringify(same));assert.equal(same.data.event.Estado,'ACTIVO');assert.equal(same.data.event.Fecha_Cancelacion,'');assert.equal(f.props.get('CALENDAR_DATA_VERSION'),v);assert.equal(f.logs.at(-1)[3],'CREADO');
 const changed=f.post('update',id,'fixture-token',{...e,Nombre:'QA FINAL MEGALINK EDITADO'});assert.equal(changed.ok,true,JSON.stringify(changed));assert.equal(f.logs.at(-1)[3],'MODIFICADO');
}
{
 const f=fixture(), e={Tipo:'PRISA Inspira',Nombre:'QA FINAL MEGALINK',Sistema:'Caracol',Fecha_Inicio:'2026-09-28',Comercializable:'No'};
 const before=f.rows.length, v=f.props.get('CALENDAR_DATA_VERSION'); f.failHistory();
 const response=f.post('megacreate',null,'fixture-token',e);assert.equal(response.ok,false);
 assert.equal(f.rows.length,before);assert.equal(f.props.get('CALENDAR_DATA_VERSION'),v);
}
console.log('MEGA behavior: legacy, token, soft delete, idempotence, history, purge and rollback OK');
