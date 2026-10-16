(()=>{'use strict';
const $=id=>document.getElementById(id),core=window.RavrentFleetCore;
if(!core)return;
const ANNOTATION_KEY='ravrent_fleet_annotations_v1';
const SOURCE_KEYS={
 garage:'ravrent-mechanic-v2',schedule:'ravrent_service_schedule_v1',
 repairCases:'ravrent_repair_cases_v1',casebook:'ravrent_diagnostic_casebook_v1',
 workshop:'ravrent_workshop_estimates_v1',inventory:'ravrent_reseller_inventory_v1'
};
const formatMoney=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const formatMiles=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
let filter='all',snapshot={vehicles:[],missing:{},totals:{}},annotations={};
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
const value=id=>String($(id)?.value||'').trim();
function localJson(key,fallback){
 try{const raw=localStorage.getItem(key);if(!raw)return fallback;const data=JSON.parse(raw);return data===null?fallback:data}
 catch{return fallback}
}
function readSources(){
 return {garage:localJson(SOURCE_KEYS.garage,{}),
 schedule:localJson(SOURCE_KEYS.schedule,{}),
 repairCases:localJson(SOURCE_KEYS.repairCases,[]),
 casebook:localJson(SOURCE_KEYS.casebook,[]),
 workshop:localJson(SOURCE_KEYS.workshop,[]),
 inventory:localJson(SOURCE_KEYS.inventory,[]),
 annotations
 }
}
function reload(){
 annotations=core.sanitizeAnnotations(localJson(ANNOTATION_KEY,{}));
 const today=new Date();
 const localDate=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
 try{snapshot=core.build(readSources(),localDate)}
 catch{snapshot={vehicles:[],missing:{repairCases:0,casebook:0,workshop:0,inventory:0,schedule:0},totals:{vehicles:0,urgent:0,due:0,quotedNotCollected:0,unlinked:0}}}
 render();
}
const STATE_LABEL={active:'In service',inspection:'Inspection needed',hold:'On hold',out_of_service:'Out of service'};
const PHASE_LABEL={due:'Due now',soon:'Due soon',scheduled:'Scheduled',completed:'Completed (user recorded)'};
function link(label,url){const a=make('a','',label);a.href=url;return a}
function button(label,onClick){
 const b=make('button','',label);b.type='button';b.addEventListener('click',onClick);return b
}
function actionHandoff(kind,vehicle){
 try{
  if(kind==='casebook')sessionStorage.setItem('ravrent_casebook_intake_v1',JSON.stringify({
   vin:vehicle.vin,vehicle:vehicle.name,created:Date.now()
  }));
  else if(kind==='workshop')sessionStorage.setItem('ravrent_workshop_intake_v1',JSON.stringify({
   vin:vehicle.vin,vehicle:vehicle.name,created:Date.now()
  }));
  else if(kind==='ai'){
   const question='Help me plan a safe evidence-first diagnostic review of this garage vehicle. '+
    'Vehicle: '+vehicle.name+'. '+(vehicle.vin?'VIN '+vehicle.vin+'. ':'')+
    (vehicle.miles!==null?'Reported odometer '+vehicle.miles+' miles. ':'')+
    'Scheduled service due now: '+vehicle.due+'. Open self-reported cases: '+(vehicle.repairCount+vehicle.caseCount)+'. '+
    'Never assume an unverified repair, recall status or mechanical fault. Ask about actual symptoms and measurements.';
   sessionStorage.setItem('ravrent_ai_intake_v1',JSON.stringify({source:'fleet',question:question.slice(0,3000),created:Date.now()}))
  }
  location.href=kind==='casebook'?'/casebook.html':kind==='workshop'?'/workshop.html':'/';
 }catch{$('fleetStatus').textContent='Could not transfer vehicle context. Open the destination tool and choose the vehicle manually.'}
}
function noteList(container,heading,entries,empty){
 const panel=make('div','fleet-detail-panel'),h=make('h4','',heading);panel.append(h);
 if(!entries.length)panel.append(make('p','',empty));
 else for(const entry of entries.slice(0,8))panel.append(make('p','',entry));
 container.append(panel)
}
function fleetCard(v){
 const article=make('article','fleet-vehicle'+(v.urgent?' is-urgent':'')),body=make('div','fleet-vehicle-main');
 const heading=make('div','fleet-vehicle-line'),left=make('div'),side=make('div','fleet-amount');
 const statusClass=v.urgent||v.state==='out_of_service'?'danger':v.state==='hold'||v.state==='inspection'?'warning':'';
 left.append(make('span','fleet-status-tag '+statusClass,STATE_LABEL[v.state]||'In service'),make('h3','',v.name));
 left.append(make('p','fleet-secondary',(v.miles===null?'Mileage not recorded':formatMiles.format(v.miles)+' mi')+
  ' · '+(v.vin?'VIN '+v.vin:'No VIN linked')+(v.owner?' · '+v.owner:'')));
 side.append(make('strong','',formatMoney.format(v.quoteValue)),make('small','','Open quotes · not collected'));
 heading.append(left,side);body.append(heading);
 const alerts=make('div','fleet-alerts');
 if(v.urgent)alerts.append(make('span','critical','Safety concern reported'));
 if(v.due)alerts.append(make('span','due',v.due+' service due'));
 if(v.soon)alerts.append(make('span','',v.soon+' service soon'));
 if(v.caseCount||v.repairCount)alerts.append(make('span','',(v.caseCount+v.repairCount)+' open case(s)'));
 if(v.quoteCount)alerts.append(make('span','',v.quoteCount+' linked quote(s)'));
 if(v.inventoryCount)alerts.append(make('span','',v.inventoryCount+' reseller record(s)'));
 if(!alerts.children.length)alerts.append(make('span','','No due tasks or linked issues recorded'));
 body.append(alerts);
 const actions=make('div','fleet-actions');
 actions.append(link('Service plan','/health-center.html?vehicle='+encodeURIComponent(v.id)),
  button('New case',()=>actionHandoff('casebook',v)),
  button('Prepare quote',()=>actionHandoff('workshop',v)));
 if(v.vin)actions.append(link('VIN research','/vin-report.html?vin='+encodeURIComponent(v.vin)));
 actions.append(button('AI review',()=>actionHandoff('ai',v)));
 body.append(actions);article.append(body);
 const details=make('details','fleet-details');
 details.append(make('summary','','Detailed vehicle records and settings'));
 const columns=make('div','fleet-detail-columns');
 const service=v.plans.map(p=>(PHASE_LABEL[p.computed.status]||p.computed.status)+' · '+p.name+
 (p.dueMileage!==null?' · '+formatMiles.format(p.dueMileage)+' mi':'')+(p.dueDate?' · '+p.dueDate:''));
 noteList(columns,'Maintenance and next due',service,'No saved maintenance schedules for this vehicle.');
 const issues=[...v.openRepairs.map(c=>c.title+' · '+(c.priority||c.status)),...v.openCases.map(c=>c.title+(c.codes?.length?' · '+c.codes.join(', '):''))];
 noteList(columns,'Open repair and diagnostic cases',issues,'No linked active diagnostic cases.');
 details.append(columns);
 const editor=make('div','fleet-editor');
 const status=make('select'),labels=Object.entries(STATE_LABEL);
 for(const [key,label] of labels){const opt=make('option','',label);opt.value=key;status.append(opt)}
 status.value=v.state;
 const owner=make('input');owner.value=v.owner;owner.placeholder='Team, driver or location';owner.maxLength=70;
 const notes=make('input');notes.value=v.notes;notes.placeholder='Operations note (not a diagnosis)';notes.maxLength=700;
 const field=(name,control)=>{const item=make('label','',name);item.append(control);return item};
 editor.append(field('Fleet status',status),field('Assigned driver / location',owner),field('Operations notes',notes));
 const save=button('Save details',()=>{
  const old=annotations;
  const next=core.sanitizeAnnotations({...annotations,[v.id]:{state:status.value,owner:owner.value,notes:notes.value}});
  try{localStorage.setItem(ANNOTATION_KEY,JSON.stringify(next));annotations=next;reload();$('fleetStatus').textContent='Fleet details saved only on this browser.'}
  catch{annotations=old;$('fleetStatus').textContent='Unable to save fleet details. Your browser storage may be full or blocked.'}
 });
 editor.append(save);details.append(editor);article.append(details);
 return article
}
function matches(v,q){
 return [v.name,v.vin,v.owner,v.notes,v.engine].join(' ').toLowerCase().includes(q)
}
function render(){
 $('fleetTotal').textContent=String(snapshot.totals.vehicles||0);
 $('fleetUrgent').textContent=String(snapshot.totals.urgent||0);
 $('fleetDue').textContent=String(snapshot.totals.due||0);
 $('fleetQuotes').textContent=formatMoney.format(snapshot.totals.quotedNotCollected||0);
 const query=value('fleetSearch').toLowerCase();
 const shown=snapshot.vehicles.filter(v=>matches(v,query)&&(
  filter==='all'||filter==='urgent'&&v.urgent||filter==='due'&&v.due>0||
  filter==='active'&&v.state==='active'||filter==='hold'&&['hold','out_of_service','inspection'].includes(v.state)
 ));
 const host=$('fleetVehicles');host.replaceChildren();
 if(!snapshot.vehicles.length){
  const blank=make('div','fleet-empty');blank.append(make('h3','','No Garage vehicles yet'),
   make('p','','Add your first car to My Garage. Fleet Command will automatically connect its maintenance plans, safety concerns and exact-VIN shop records.'));
  blank.append(link('Open My Garage','/'));host.append(blank);
 }else if(!shown.length){
  const blank=make('div','fleet-empty');blank.append(make('h3','','No vehicles match'),make('p','','Try another filter or search. Your records have not been changed.'));host.append(blank)
 }else for(const v of shown)host.append(fleetCard(v));
 $('fleetStatus').textContent=snapshot.vehicles.length+' garage vehicle(s) · '+shown.length+' shown · Local browser only. Statuses and safety flags are user-entered.';
 const unmatched=snapshot.missing||{};
 $('unlinkedTotal').textContent=String(snapshot.totals.unlinked||0);
 const holder=$('unlinkedBreakdown');holder.replaceChildren();
 for(const [key,label] of [['repairCases','Repair cases'],['casebook','Diagnostic cases'],['workshop','Workshop quotes'],['inventory','Resale records'],['schedule','Service plans']]){
  const item=make('div');item.append(make('strong','',unmatched[key]||0),make('span','',label));holder.append(item)
 }
}
function escapeCsv(v){let str=String(v??'');if(/^\s*[=+\-@]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"'}
function exportCsv(){
 if(!snapshot.vehicles.length){$('fleetStatus').textContent='Add a garage vehicle before exporting a fleet CSV.';return}
 const header=['Vehicle','VIN','Odometer (reported)','Fleet status','Assignment','Safety risk (reported)','Services due','Services soon','Open cases','Open quotes (not collected)','Unlinked quote count','Notes'];
 const lines=[header.map(escapeCsv).join(',')];
 for(const v of snapshot.vehicles)lines.push([v.name,v.vin,v.miles??'',STATE_LABEL[v.state],v.owner,
  v.urgent?'Yes, self-reported':'No reported concern',v.due,v.soon,v.caseCount+v.repairCount,v.quoteValue,v.quoteCount,v.notes].map(escapeCsv).join(','));
 const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),anchor=make('a');anchor.href=url;anchor.download='ravrent-fleet-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1400);
 $('fleetStatus').textContent='Fleet CSV exported from local records. Keep assignments and VIN data private.'
}
$('fleetSearch').addEventListener('input',render);
$('fleetRefresh').addEventListener('click',reload);
$('fleetExport').addEventListener('click',exportCsv);
document.querySelectorAll('[data-fleet-filter]').forEach(b=>b.addEventListener('click',()=>{
 filter=b.dataset.fleetFilter;
 document.querySelectorAll('[data-fleet-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 render()
}));
window.addEventListener('storage',e=>{if(Object.values(SOURCE_KEYS).includes(e.key)||e.key===ANNOTATION_KEY)reload()});
window.addEventListener('pageshow',()=>reload());
reload();
})();