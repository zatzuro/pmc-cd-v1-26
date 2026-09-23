const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const source=fs.readFileSync('dist/app.js','utf8');

function loadFunction(name,nextMarker){
  const start=source.indexOf(`function ${name}`);
  const end=source.indexOf(nextMarker,start);
  assert(start>=0&&end>start,`No se encontró ${name}`);
  const context={};
  vm.runInNewContext(`${source.slice(start,end)};this.result=${name}`,context);
  return context.result;
}

const initialMonth=loadFunction('initialMonth','\n  const state=');
assert.strictEqual(initialMonth(new Date(2026,7,31,12)),8);
assert.strictEqual(initialMonth(new Date(2026,9,15,12)),9);
assert.strictEqual(initialMonth(new Date(2027,0,1,12)),11);

const sortAgendaItems=loadFunction('sortAgendaItems','\n  function renderAgenda');
const items=[
  {kind:'event',data:{Nombre:'18:00',Hora_Inicio:'18:00'}},
  {kind:'event',data:{Nombre:'Sin hora A',Hora_Inicio:''}},
  {kind:'event',data:{Nombre:'08:00',Hora_Inicio:'08:00'}},
  {kind:'event',data:{Nombre:'Sin hora B'}},
  {kind:'event',data:{Nombre:'10:30',Hora_Inicio:'10:30'}}
];
assert.deepStrictEqual(Array.from(sortAgendaItems(items),x=>x.data.Nombre),['Sin hora A','Sin hora B','08:00','10:30','18:00']);

console.log('Ajustes puntuales: OK');
