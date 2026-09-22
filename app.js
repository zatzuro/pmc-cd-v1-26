(function(){
  'use strict';
  const cfg=window.PRISA_CALENDAR_CONFIG||{};
  const MONTHS=['Septiembre','Octubre','Noviembre','Diciembre'];
  const MONTH_INDEX=[8,9,10,11];
  const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const COLORS=['#2780e8','#13a05a','#9354d8','#ee8a22','#ee3f83','#e13f44','#385d8c','#13a0a2'];
  const state={month:8,events:[],specialDays:[],config:{tiposEvento:[]},filters:{search:'',type:'',commercial:'',availability:'',specialDays:'__holidays'},view:'month',selected:null,pendingDelete:null};
  const metrics={apiGetCalls:0,renderCalls:0,loadMs:0};
  function syncMetrics(){const d=document.documentElement.dataset;d.apiGetCalls=metrics.apiGetCalls;d.renderCalls=metrics.renderCalls;d.loadMs=metrics.loadMs}
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

  function isoDate(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
  function parseDate(s){if(!s)return null;const [y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,m-1,d,12)}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function colorFor(type){const types=state.config.tiposEvento||[];const i=Math.max(0,types.indexOf(type));return COLORS[i%COLORS.length]}
  function apiReady(){return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(cfg.API_URL||'')}
  async function apiGet(action='bootstrap'){
    metrics.apiGetCalls++;syncMetrics();
    if(!apiReady())throw new Error('La aplicación está lista, pero aún falta conectar la URL publicada de Google Apps Script.');
    const res=await fetch(`${cfg.API_URL}?action=${encodeURIComponent(action)}&t=${Date.now()}`,{redirect:'follow',cache:'no-store'});
    if(!res.ok)throw new Error('No fue posible consultar el calendario.');
    const json=await res.json();if(!json.ok)throw new Error(json.error||'La API devolvió un error.');return json.data;
  }
  async function apiPost(payload){
    if(!apiReady())throw new Error('Aún falta conectar la URL publicada de Google Apps Script.');
    const res=await fetch(cfg.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});
    if(!res.ok)throw new Error('No fue posible guardar el cambio.');
    const json=await res.json();if(!json.ok)throw new Error(json.error||'La API devolvió un error.');return json.data;
  }
  async function load(){
    const started=performance.now();
    $('#loading').hidden=false;$('#calendar').hidden=true;$('#agenda').hidden=true;$('#status').hidden=true;
    try{const data=await apiGet();state.events=data.events||[];state.specialDays=data.specialDays||[];state.config=data.config||{tiposEvento:[]};populateTypes();populateSpecialDayTypes();render()}
    catch(e){showStatus(e.message);render()}
    finally{$('#loading').hidden=true;metrics.loadMs=Math.round(performance.now()-started);syncMetrics()}
  }
  function showStatus(msg){const el=$('#status');el.textContent=msg;el.hidden=false}
  function populateTypes(){
    const types=state.config.tiposEvento||[];['#filterType','#eventType'].forEach((sel,n)=>{const el=$(sel),first=el.options[0];el.innerHTML='';el.append(first);types.forEach(t=>el.add(new Option(t,t))) });
    const legend=$('#legend');legend.querySelectorAll('span').forEach(x=>x.remove());types.forEach((t,i)=>{const s=document.createElement('span');s.innerHTML=`<i class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></i>${esc(t)}`;legend.append(s)})
  }
  function normalizeType(v){return String(v||'').trim().toLocaleLowerCase('es')}
  function populateSpecialDayTypes(){
    const select=$('#filterSpecialDays'),categories=[...new Set(state.specialDays.map(s=>String(s.Tipo||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
    select.innerHTML='<option value="__holidays">Solo festivos</option><option value="__all">Todas</option>';
    categories.filter(t=>normalizeType(t)!=='festivo').forEach(t=>select.add(new Option(t,t)));
    select.value=state.filters.specialDays;
  }
  function filteredEvents(){const q=state.filters.search.toLocaleLowerCase('es');return state.events.filter(e=>(!q||String(e.Nombre).toLocaleLowerCase('es').includes(q))&&(!state.filters.type||e.Tipo===state.filters.type)&&(!state.filters.commercial||e.Comercializable===state.filters.commercial)&&(!state.filters.availability||e.Disponibilidad===state.filters.availability))}
  function filteredSpecialDays(){const selected=state.filters.specialDays;if(selected==='__all')return state.specialDays;if(selected==='__holidays')return state.specialDays.filter(s=>normalizeType(s.Tipo)==='festivo');return state.specialDays.filter(s=>s.Tipo===selected)}
  function indexByRange(items){const map=new Map();items.forEach(item=>{let d=parseDate(item.Fecha_Inicio),end=parseDate(item.Fecha_Fin||item.Fecha_Inicio);if(!d||!end)return;for(;d<=end;d=addDays(d,1)){const key=isoDate(d);if(!map.has(key))map.set(key,[]);map.get(key).push(item)}});return map}
  function indexByStart(items){const map=new Map();items.forEach(item=>{const key=item.Fecha_Inicio;if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(item)});return map}
  function viewData(){const events=filteredEvents(),specialDays=filteredSpecialDays();return{events,specialDays,eventRanges:indexByRange(events),specialRanges:indexByRange(specialDays),eventStarts:indexByStart(events),specialStarts:indexByStart(specialDays)}}
  function isCommercializable(e){return ['si','sí'].includes(String(e?.Comercializable||'').trim().toLocaleLowerCase('es'))}
  function isHoliday(s){return normalizeType(s.Tipo)==='festivo'}
  function render(){
    metrics.renderCalls++;syncMetrics();
    const data=viewData(),hasEvents=data.events.some(e=>{const start=parseDate(e.Fecha_Inicio),end=parseDate(e.Fecha_Fin||e.Fecha_Inicio);return start&&end&&start.getMonth()<=state.month&&end.getMonth()>=state.month}),hasSpecial=data.specialDays.some(s=>{const start=parseDate(s.Fecha_Inicio),end=parseDate(s.Fecha_Fin||s.Fecha_Inicio);return start&&end&&start.getMonth()<=state.month&&end.getMonth()>=state.month}),empty=!hasEvents&&!hasSpecial,mobile=matchMedia('(max-width:850px)').matches,showAgenda=mobile||state.view==='agenda';
    $('#monthTitle').textContent=`${MONTHS[state.month-8]} 2026`;if(showAgenda)renderAgenda(data);else renderCalendar(data);
    $('#emptyState').hidden=!empty;$('#calendar').hidden=showAgenda||empty;$('#agenda').hidden=!showAgenda||empty;
  }
  function renderCalendar(data){
    const root=$('#calendar');root.innerHTML=`<div class="week-row">${DAYS.map(d=>`<div class="weekday">${d}</div>`).join('')}</div>`;
    const first=new Date(2026,state.month,1,12),mondayOffset=(first.getDay()+6)%7,start=addDays(first,-mondayOffset),fragment=document.createDocumentFragment();
    for(let w=0;w<6;w++){const row=document.createElement('div');row.className='week-row';for(let i=0;i<7;i++){const date=addDays(start,w*7+i),key=isoDate(date);const cell=document.createElement('div');cell.className=`day-cell ${date.getMonth()!==state.month?'outside':''} ${i===6?'sunday':''}`;cell.innerHTML=`<div class="day-number"><span>${date.getDate()}</span></div>`;
      (data.specialRanges.get(key)||[]).forEach(s=>{const b=document.createElement('button');b.className=`special-chip ${isHoliday(s)?'holiday':''}`;b.textContent=s.Nombre;b.onclick=()=>openSpecial(s);cell.append(b)});
      const todays=data.eventRanges.get(key)||[];todays.slice(0,3).forEach(e=>{const b=document.createElement('button');const startKey=e.Fecha_Inicio,endKey=e.Fecha_Fin||e.Fecha_Inicio;b.className='event-chip '+(startKey!==endKey?(key===startKey?'range-start':key===endKey?'range-end':'range-middle'):'');b.style.setProperty('--event-color',colorFor(e.Tipo));b.innerHTML=`${esc(e.Nombre)}${isCommercializable(e)&&key===startKey?`<span class="availability-mini ${e.Disponibilidad==='Cupo lleno'?'full':''}">${esc(e.Disponibilidad)}</span>`:''}`;b.onclick=()=>openDetail(e);cell.append(b)});if(todays.length>3){const m=document.createElement('button');m.className='more-button';m.textContent=`+${todays.length-3} más`;m.onclick=()=>{state.view='agenda';render()};cell.append(m)}row.append(cell)}fragment.append(row)}root.append(fragment)
  }
  function renderAgenda(data){
    const root=$('#agenda');root.innerHTML='';const start=new Date(2026,state.month,1,12),end=new Date(2026,state.month+1,0,12),fragment=document.createDocumentFragment();
    for(let d=start;d<=end;d=addDays(d,1)){const key=isoDate(d),items=[...(data.specialStarts.get(key)||[]).map(s=>({kind:'special',data:s})),...(data.eventStarts.get(key)||[]).map(e=>({kind:'event',data:e}))];items.forEach(item=>{const wrap=document.createElement('div');wrap.className='agenda-day';const weekday=new Intl.DateTimeFormat('es-CO',{weekday:'short'}).format(d);wrap.innerHTML=`<div class="agenda-date">${esc(weekday)}<b>${d.getDate()}</b></div>`;const b=document.createElement('button'),x=item.data;if(item.kind==='event'){b.className='agenda-card';b.style.setProperty('--event-color',colorFor(x.Tipo));b.innerHTML=`<span><strong>${esc(x.Nombre)}</strong><small>${esc(x.Tipo)}${x.Fecha_Fin?` · hasta ${formatDate(x.Fecha_Fin)}`:''}</small>${isCommercializable(x)?`<i class="status-pill ${x.Disponibilidad==='Cupo lleno'?'full':''}">${esc(x.Disponibilidad)}</i>`:''}</span><span>›</span>`;b.onclick=()=>openDetail(x)}else{b.className=`agenda-card ${isHoliday(x)?'holiday-card':'special-card'}`;b.innerHTML=`<span><strong>${esc(x.Nombre)}</strong><small>${esc(x.Tipo||'Día especial')}</small></span><span>›</span>`;b.onclick=()=>openSpecial(x)}wrap.append(b);fragment.append(wrap)})}root.append(fragment)
  }
  function formatDate(s){const d=parseDate(s);return d?new Intl.DateTimeFormat('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d):''}
  function formatRange(e){return e.Fecha_Fin?`${formatDate(e.Fecha_Inicio)} – ${formatDate(e.Fecha_Fin)}`:formatDate(e.Fecha_Inicio)}
  function openDetail(e){state.selected=e;const color=colorFor(e.Tipo),commercial=isCommercializable(e);$('#detailContent').innerHTML=`<div style="--event-color:${color}"><div class="detail-type">${esc(e.Tipo)}</div><h2 class="detail-title" id="detailTitle">${esc(e.Nombre)}</h2>${commercial?`<span class="status-pill ${e.Disponibilidad==='Cupo lleno'?'full':''}">${esc(e.Disponibilidad)}</span>`:''}<div class="detail-meta"><div class="detail-row"><span>▣</span><div>${esc(formatRange(e))}</div></div><div class="detail-row"><span>◉</span><div>${commercial?'Comercializable':'No comercializable'}</div></div>${e.Enlace?`<div class="detail-row"><span>↗</span><a class="detail-link" href="${esc(e.Enlace)}" target="_blank" rel="noopener noreferrer">Ver enlace</a></div>`:''}</div>${e.Descripcion?`<div class="detail-description">${esc(e.Descripcion)}</div>`:''}<div class="detail-actions"><button class="button secondary" data-action="edit-selected">Editar</button><button class="button danger" data-action="delete-selected">Eliminar</button></div></div>`;$('#detailModal').hidden=false;lockBody(true)}
  function openSpecial(s){$('#detailContent').innerHTML=`<div><div class="detail-type">${esc(s.Tipo||'Día especial')}</div><h2 class="detail-title" id="detailTitle">${esc(s.Nombre)}</h2><div class="detail-meta"><div class="detail-row"><span>▣</span><div>${esc(s.Fecha_Fin?`${formatDate(s.Fecha_Inicio)} – ${formatDate(s.Fecha_Fin)}`:formatDate(s.Fecha_Inicio))}</div></div></div>${s.Descripcion?`<div class="detail-description">${esc(s.Descripcion)}</div>`:''}</div>`;state.selected=null;$('#detailModal').hidden=false;lockBody(true)}
  function lockBody(on){document.body.style.overflow=on?'hidden':''}
  function openForm(e){
    $('#eventForm').reset();$('#formError').hidden=true;$('#eventId').value=e?.ID||'';$('#formTitle').textContent=e?'Editar evento':'Crear evento';$('#saveButton').textContent=e?'Guardar cambios':'Guardar evento';
    if(e){$('#eventType').value=e.Tipo;$('#eventName').value=e.Nombre;$('#startDate').value=e.Fecha_Inicio;$('#endDate').value=e.Fecha_Fin||'';$('#description').value=e.Descripcion||'';$('#eventLink').value=e.Enlace||'';const c=$(`input[name=commercial][value="${e.Comercializable}"]`);if(c)c.checked=true;const a=$(`input[name=availability][value="${e.Disponibilidad}"]`);if(a)a.checked=true}
    updateAvailability();updateCount();$('#detailModal').hidden=true;$('#formModal').hidden=false;lockBody(true);setTimeout(()=>$('#eventType').focus(),0)
  }
  function closeModals(){['#formModal','#detailModal','#confirmModal'].forEach(x=>$(x).hidden=true);lockBody(false)}
  function updateAvailability(){const yes=$('input[name=commercial]:checked')?.value==='Sí';$('#availabilityGroup').hidden=!yes;$$('input[name=availability]').forEach(x=>x.required=yes);if(!yes)$$('input[name=availability]').forEach(x=>x.checked=false)}
  function updateCount(){$('#descriptionCount').textContent=$('#description').value.length}
  function readForm(){return{Tipo:$('#eventType').value,Nombre:$('#eventName').value.trim(),Fecha_Inicio:$('#startDate').value,Fecha_Fin:$('#endDate').value,Comercializable:$('input[name=commercial]:checked')?.value||'',Disponibilidad:$('input[name=availability]:checked')?.value||'',Descripcion:$('#description').value.trim(),Enlace:$('#eventLink').value.trim()}}
  function validate(data){if(!data.Tipo)return 'Selecciona el tipo de evento.';if(!data.Nombre)return 'Escribe el nombre del evento.';if(!data.Fecha_Inicio)return 'Selecciona la fecha de inicio.';if(data.Fecha_Inicio<cfg.PILOT_START||data.Fecha_Inicio>cfg.PILOT_END)return 'La fecha debe estar dentro del piloto: septiembre a diciembre de 2026.';if(data.Fecha_Fin&&(data.Fecha_Fin<data.Fecha_Inicio||data.Fecha_Fin>cfg.PILOT_END))return 'Revisa la fecha de fin.';if(!data.Comercializable)return 'Indica si el evento es comercializable.';if(data.Comercializable==='Sí'&&!data.Disponibilidad)return 'Selecciona la disponibilidad.';if(data.Enlace&&!/^https?:\/\//i.test(data.Enlace))return 'El enlace debe comenzar por http:// o https://.';return ''}
  async function submitForm(ev){ev.preventDefault();const data=readForm(),error=validate(data),err=$('#formError');if(error){err.textContent=error;err.hidden=false;return}err.hidden=true;const btn=$('#saveButton');btn.disabled=true;btn.textContent='Guardando…';try{const id=$('#eventId').value;const result=await apiPost(id?{action:'update',id,event:data}:{action:'create',event:data});const saved=result.event;if(id)state.events=state.events.map(e=>e.ID===id?saved:e);else state.events.push(saved);closeModals();render();toast(id?'Evento actualizado':'Evento creado')}catch(e){err.textContent=e.message;err.hidden=false}finally{btn.disabled=false;btn.textContent=$('#eventId').value?'Guardar cambios':'Guardar evento'}}
  async function deleteEvent(){const btn=$('[data-action=confirm-delete]');btn.disabled=true;btn.textContent='Eliminando…';try{await apiPost({action:'delete',id:state.pendingDelete.ID});state.events=state.events.filter(e=>e.ID!==state.pendingDelete.ID);closeModals();render();toast('Evento eliminado')}catch(e){closeModals();showStatus(e.message)}finally{btn.disabled=false;btn.textContent='Eliminar'}}
  function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;setTimeout(()=>t.hidden=true,2800)}
  function setView(v){state.view=v;$$('.view-tab').forEach(b=>{const active=b.dataset.view===v;b.classList.toggle('active',active);b.setAttribute('aria-selected',active)});$$('[data-mobile-view]').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===v));render()}
  document.addEventListener('click',e=>{const a=e.target.closest('[data-action]');if(a){const action=a.dataset.action;if(action==='create')openForm();if(action==='close-form'||action==='close-detail')closeModals();if(action==='previous-month'&&state.month>8){state.month--;render()}if(action==='next-month'&&state.month<11){state.month++;render()}if(action==='clear-filters'){state.filters={search:'',type:'',commercial:'',availability:'',specialDays:'__holidays'};$('#search').value='';$('#filterType').value='';$('#filterCommercial').value='';$('#filterAvailability').value='';$('#filterSpecialDays').value='__holidays';render()}if(action==='toggle-filters')$('#filtersPanel').classList.toggle('open');if(action==='edit-selected')openForm(state.selected);if(action==='delete-selected'){state.pendingDelete=state.selected;$('#detailModal').hidden=true;$('#confirmModal').hidden=false}if(action==='cancel-delete'){closeModals()}if(action==='confirm-delete')deleteEvent()}const v=e.target.closest('[data-view]');if(v)setView(v.dataset.view);const mv=e.target.closest('[data-mobile-view]');if(mv)setView(mv.dataset.mobileView)});
  $('#eventForm').addEventListener('submit',submitForm);$$('input[name=commercial]').forEach(x=>x.addEventListener('change',updateAvailability));$('#description').addEventListener('input',updateCount);
  [['#search','search','input'],['#filterType','type','change'],['#filterCommercial','commercial','change'],['#filterAvailability','availability','change'],['#filterSpecialDays','specialDays','change']].forEach(([sel,key,event])=>$(sel).addEventListener(event,e=>{state.filters[key]=e.target.value;render()}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModals()});window.addEventListener('resize',render);load();
})();
