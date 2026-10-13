(()=>{'use strict';
const $=id=>document.getElementById(id),GARAGE='ravrent-mechanic-v2',TOOL='ravrent_toolkit_v1',CASES='ravrent_repair_cases_v1';
const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return {}}};
const garage=parse(GARAGE),tool=parse(TOOL);let cases=parse(CASES);cases=Array.isArray(cases)?cases:[];let editing=null;
const vehicles=Array.isArray(garage.vehicles)?garage.vehicles:[],services=Array.isArray(tool.services)?tool.services:[];
const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const val=id=>$(id).value.trim();
const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;if(cls)x.className=cls;return x};
const message=s=>$('caseMessage').textContent=s;
const persist=()=>{try{localStorage.setItem(CASES,JSON.stringify(cases));return true}catch{message('Storage is unavailable or full. Export your cases.');return false}};
const download=(name,data)=>{const blob=new Blob([data],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const vehicleName=v=>[v.year,v.make,v.model].filter(Boolean).join(' ')||'Unknown vehicle';
function fillVehicles(){const select=$('caseVehicle');select.replaceChildren();select.append(new Option('Unassigned vehicle',''));vehicles.forEach(v=>select.append(new Option(vehicleName(v),String(v.id))));}
function render(){const open=cases.filter(c=>c.status!=='resolved');$('vehicleCount').textContent=vehicles.length;$('caseCount').textContent=open.length;$('serviceCount').textContent=services.length;$('repairTotal').textContent=usd(open.reduce((n,c)=>n+(Number(c.cost)||0),0));
 const overview=$('vehicleOverview');overview.replaceChildren();if(!vehicles.length)overview.append(el('div','No garage vehicles saved yet. Add one from My Garage.','record'));
 vehicles.forEach(v=>{const row=el('div',undefined,'record');row.append(el('strong',vehicleName(v)),el('p','Recorded mileage: '+(Number(v.miles)||'Not recorded')+' · Open cases: '+open.filter(c=>c.vehicleId===String(v.id)).length));overview.append(row)});
 const history=$('maintenanceOverview');history.replaceChildren();if(!services.length)history.append(el('div','No maintenance records yet.','record'));
 services.slice(0,10).forEach(s=>{const row=el('div',undefined,'record');row.append(el('strong',(s.vehicle||'Vehicle')+' · '+(s.service||'Service')),el('p',[s.date,s.miles!=null?s.miles+' mi':'',s.cost!=null?usd(s.cost):''].filter(Boolean).join(' · ')));history.append(row)});
 const list=$('caseList');list.replaceChildren();if(!cases.length)list.append(el('div','No repair cases yet.','record'));
 cases.slice().sort((a,b)=>b.updated-a.updated).forEach(c=>{const row=el('div',undefined,'record'),v=vehicles.find(x=>String(x.id)===c.vehicleId);
 row.append(el('strong',c.title||'Untitled repair'),el('p',[v?vehicleName(v):'Unassigned',c.status,c.priority,c.codes].filter(Boolean).join(' · '),'priority'),el('p','Estimated repair: '+usd(c.cost)),el('p',c.symptoms||'No symptoms recorded'));
 if(c.tests)row.append(el('p','Tests / confirmed fix: '+c.tests));
 const actions=el('div',undefined,'case-actions'),edit=el('button','Edit'),remove=el('button','Delete');
 edit.onclick=()=>{editing=c.id;for(const [key,id] of Object.entries({vehicleId:'caseVehicle',title:'caseTitle',codes:'caseCodes',priority:'casePriority',cost:'caseCost',status:'caseStatus',symptoms:'caseSymptoms',tests:'caseTests'}))$(id).value=c[key]??'';message('Editing case. Save to apply changes.');$('caseTitle').focus();};
 remove.onclick=()=>{if(!confirm('Delete this repair case?'))return;cases=cases.filter(x=>x.id!==c.id);persist();render();message('Case deleted.')};
 const ai=el('button','Review with AI');ai.type='button';
 ai.onclick=()=>{
  const prompt='Review this user-entered automotive repair case. Vehicle: '+(v?vehicleName(v):'Unassigned')+
   '. Issue: '+String(c.title||'').slice(0,180)+'. Codes: '+String(c.codes||'').slice(0,220)+
   '. Symptoms: '+String(c.symptoms||'').slice(0,1100)+'. Owner-entered checks: '+String(c.tests||'').slice(0,700)+
   '. Distinguish confirmed evidence from assumptions, prioritize safety, and recommend inexpensive next diagnostic steps. Do not invent measurements or claim repairs were confirmed.';
  try{sessionStorage.setItem('ravrent_ai_intake_v1',JSON.stringify({source:'health',question:prompt.slice(0,3150),created:Date.now()}));location.href='/'}
  catch{message('Could not prepare the AI request. Open Diagnostics and describe this case manually.')}
 };
 actions.append(edit,ai,remove);row.append(actions);list.append(row)});
}
function clear(){editing=null;for(const id of ['caseTitle','caseCodes','caseSymptoms','caseTests'])$(id).value='';$('caseCost').value='0';$('casePriority').value='routine';$('caseStatus').value='open';$('caseVehicle').value='';}
$('clearCase').onclick=()=>{clear();message('Form cleared.')};
$('saveCase').onclick=()=>{const title=val('caseTitle');if(!title){message('Enter a problem title.');return}const cost=Number(val('caseCost')||0);if(!Number.isFinite(cost)||cost<0||cost>1000000){message('Enter a valid repair estimate between $0 and $1,000,000.');return}
 const old=cases.find(c=>c.id===editing);const next={id:old?.id||('case-'+Date.now()+'-'+Math.random().toString(36).slice(2)),created:old?.created||Date.now(),updated:Date.now(),vehicleId:val('caseVehicle'),title:title.slice(0,180),codes:val('caseCodes').slice(0,300),priority:val('casePriority'),status:val('caseStatus'),cost,symptoms:val('caseSymptoms').slice(0,8000),tests:val('caseTests').slice(0,8000)};
 if(old)Object.assign(old,next);else cases.unshift(next);if(cases.length>300){message('Maximum 300 cases reached. Export and delete old cases.');if(!old)cases.shift();return}
 if(persist()){clear();render();message('Repair case saved on this device.')};
};
$('exportCases').onclick=()=>download('ravrent-repair-cases.txt','Ravrent Mechanic repair cases\n\n'+cases.map(c=>[c.title,'Vehicle: '+(vehicles.find(v=>String(v.id)===c.vehicleId)?vehicleName(vehicles.find(v=>String(v.id)===c.vehicleId)):'Unassigned'),'Status: '+c.status,'Priority: '+c.priority,'Codes: '+c.codes,'Estimated cost: '+usd(c.cost),'Symptoms: '+c.symptoms,'Tests / repair: '+c.tests].join('\n')).join('\n\n---\n\n'));
fillVehicles();render();
})();