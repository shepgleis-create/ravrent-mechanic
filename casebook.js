(()=>{'use strict';
const $=id=>document.getElementById(id),engine=window.RavrentCasebookCore;
if(!engine)return;
const KEY='ravrent_diagnostic_casebook_v1',FORMAT='diagnostic-casebook',STATUSES={open:'Open',testing:'Testing',awaiting:'Waiting for evidence',resolved:'Resolved (reported)'};
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const costKeys=['diagnostic','parts','labor','other'];
const hazardKeys=['brakes','steering','fuelLeak','overheat','flashingCel','smoke'];
const els={dialog:$('caseDialog'),form:$('caseForm'),list:$('caseList'),notice:$('caseStatus')};
const text=(v,n=200)=>String(v===undefined||v===null?'':v).slice(0,n);
const make=(tag,cls,content)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=String(content);return el};
const newId=()=>globalThis.crypto?.randomUUID?.()||'case-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,11);
let cases=[],editing=null,filter='all';
function notice(message){els.notice.textContent=message}
function load(){
 try{const items=JSON.parse(localStorage.getItem(KEY)||'[]');cases=Array.isArray(items)?items.slice(0,180).flatMap(v=>{try{if(!v?.id||!v.created||!v.updated)return[];return[engine.normalizeCase(v)]}catch{return[]}}):[]}catch{cases=[]}
}
function persist(){
 try{localStorage.setItem(KEY,JSON.stringify(cases));return true}catch{return false}
}
function buildTestRow(value={}){
 const row=make('div','case-test-row');
 const name=make('input');name.placeholder='Measurement or diagnostic test';name.maxLength=140;name.value=text(value.name,140);name.dataset.kind='name';
 const select=make('select');select.dataset.kind='result';
 for(const [key,label] of [['planned','Planned / not performed'],['pass','Test passed (reported)'],['fail','Test failed (reported)'],['unclear','Inconclusive']]){const option=make('option','',label);option.value=key;select.append(option)}
 select.value=['planned','pass','fail','unclear'].includes(value.result)?value.result:'planned';
 const del=make('button','','Remove');del.type='button';del.addEventListener('click',()=>row.remove());
 const note=make('textarea');note.dataset.kind='note';note.placeholder='Observed measurement, evidence or question';note.maxLength=400;note.rows=2;note.value=text(value.note,400);
 row.append(name,select,del,note);$('caseTests').append(row);
}
function currentForm(){
 const flags={};for(const key of hazardKeys)flags[key]=!!document.querySelector('[data-hazard="'+key+'"]')?.checked;
 const tests=[...$('caseTests').children].map(row=>({
  name:row.querySelector('[data-kind="name"]').value,
  result:row.querySelector('[data-kind="result"]').value,
  note:row.querySelector('[data-kind="note"]').value
 }));
 return {
  name:$('caseName').value,vehicle:$('caseVehicle').value,vin:$('caseVin').value.toUpperCase(),miles:$('caseMiles').value,status:$('caseStage').value,
  symptoms:$('caseSymptoms').value,conditions:$('caseConditions').value,codes:$('caseCodes').value,
  flags,tests,summary:$('caseSummary').value,
  amounts:{diagnostic:$('costDiagnostic').value,parts:$('costParts').value,labor:$('costLabor').value,other:$('costOther').value}
 }
}
function readForm(){
 try{return engine.normalizeCase(currentForm())}catch(e){$('caseFeedback').textContent=e.message;return null}
}
function updateSafety(){
 const flags={};for(const key of hazardKeys)flags[key]=!!document.querySelector('[data-hazard="'+key+'"]')?.checked;
 const safety=engine.triage(flags),target=$('caseSafety');target.classList.toggle('urgent',safety.high);target.textContent=safety.reason
}
function costPreview(){
 try{$('caseCostTotal').textContent=money.format(engine.totals({diagnostic:$('costDiagnostic').value,parts:$('costParts').value,labor:$('costLabor').value,other:$('costOther').value}).total)}
 catch{$('caseCostTotal').textContent='Check values'}
}
function populate(entry={}){
 els.form.reset();
 const ids={caseName:'name',caseVehicle:'vehicle',caseVin:'vin',caseMiles:'miles',caseStage:'status',caseSymptoms:'symptoms',caseConditions:'conditions',caseCodes:'codes',caseSummary:'summary'};
 for(const [id,prop] of Object.entries(ids))$(id).value=prop==='codes'?(Array.isArray(entry.codes)?entry.codes.join(', '):text(entry.codes)):text(entry[prop]??(prop==='status'?'open':''));
 for(const [field,id] of [['diagnostic','costDiagnostic'],['parts','costParts'],['labor','costLabor'],['other','costOther']])$(id).value=entry.amounts?.[field]??'';
 for(const key of hazardKeys){const item=document.querySelector('[data-hazard="'+key+'"]');if(item)item.checked=entry.flags?.[key]===true}
 $('caseTests').replaceChildren();
 for(const test of (Array.isArray(entry.tests)?entry.tests:[]).slice(0,25))buildTestRow(test);
 if(!$('caseTests').children.length)buildTestRow();
 updateSafety();costPreview()
}
function open(entry=null){
 editing=entry?.id||null;populate(entry||{});
 $('caseDialogTitle').textContent=editing?'Edit diagnostic case':'New diagnostic case';
 $('deleteCase').hidden=!editing;$('duplicateCase').hidden=!editing;$('printCase').hidden=!editing;
 $('caseFeedback').textContent='';els.dialog.showModal()
}
function save(){
 const body=readForm();if(!body)return;
 if(!editing&&cases.length>=180){$('caseFeedback').textContent='180 cases is the local limit. Export a backup and archive old cases.';return}
 const older=cases.find(x=>x.id===editing);
 const entry={...body,id:older?.id||newId(),created:older?.created||new Date().toISOString(),updated:new Date().toISOString()};
 const prior=cases;cases=editing?cases.map(x=>x.id===editing?entry:x):[entry,...cases];
 if(!persist()){cases=prior;$('caseFeedback').textContent='Browser storage is full. Export your cases and free space.';return}
 els.dialog.close();editing=null;render();notice('Diagnostic case saved on this device. Test outcomes remain user-reported.')
}
function stats(){
 $('totalCases').textContent=String(cases.length);
 $('activeCases').textContent=String(cases.filter(x=>x.status!=='resolved').length);
 $('resolvedCases').textContent=String(cases.filter(x=>x.status==='resolved').length);
 $('urgentCases').textContent=String(cases.filter(x=>engine.triage(x.flags).high&&x.status!=='resolved').length)
}
function render(){
 stats();const host=els.list;host.replaceChildren();
 const q=$('caseSearch').value.trim().toLowerCase();
 const results=cases.filter(c=>(filter==='all'||c.status===filter)&&(!q||[c.name,c.vehicle,c.vin,(c.codes||[]).join(' '),c.symptoms].join(' ').toLowerCase().includes(q))).sort((a,b)=>String(b.updated).localeCompare(String(a.updated)));
 if(!results.length){
  const empty=make('div','case-empty');empty.append(make('h3','',cases.length?'No matching cases':'Start your first diagnostic case'),
   make('p','',cases.length?'Try a different issue, VIN, DTC or status.':'Track symptoms and real test results in a reusable case file. No AI or OBD adapter is required.'));
  if(!cases.length){const button=make('button','primary','New case');button.type='button';button.onclick=()=>open();empty.append(button)}
  host.append(empty);return
 }
 for(const c of results){
  const card=make('article','case-card'),main=make('div'),actions=make('div','case-commands'),risk=engine.triage(c.flags);
  const label=make('span','case-label '+(risk.high?'urgent':c.status),risk.high?'Reported safety concern':STATUSES[c.status]||'Open');
  main.append(label,make('h3','',c.name||'Unlabeled problem'),make('p','',c.vehicle+(c.miles?' · '+Number(c.miles).toLocaleString('en-US')+' miles':'')),
   make('p','case-meta',(c.codes?.length?'Reported codes: '+c.codes.join(', ')+' · ':'')+(c.tests?.length||0)+' documented tests · '+new Date(c.updated).toLocaleDateString('en-US')));
  const edit=make('button','','Open case');edit.type='button';edit.onclick=()=>open(c);
  const print=make('button','','Print / PDF');print.type='button';print.onclick=()=>printCase(c);
  actions.append(edit,print);
  if(c.vin){const vin=make('button','','VIN research');vin.type='button';vin.onclick=()=>{location.href='/vin-report.html?vin='+encodeURIComponent(c.vin)};actions.append(vin)}
  card.append(main,actions);host.append(card)
 }
}
function writeReport(c){
 const root=$('casePrint');root.replaceChildren();
 const row=(title,val)=>{const line=make('div','print-line');line.append(make('span','',title),make('strong','',val));root.append(line)};
 root.append(make('h1','','Vehicle diagnostic case'));
 row('Issue',c.name);row('Vehicle',c.vehicle);if(c.vin)row('VIN',c.vin);if(c.miles)row('Mileage',c.miles+' miles (reported)');
 row('Case status',STATUSES[c.status]);row('Created',c.created.slice(0,10));row('Updated',c.updated.slice(0,10));
 row('Safety triage',engine.triage(c.flags).level);
 if(c.codes?.length)row('Reported DTCs',c.codes.join(', '));
 if(c.symptoms){root.append(make('h2','','Reported symptoms'),make('p','',c.symptoms))}
 if(c.conditions){root.append(make('h2','','Conditions'),make('p','',c.conditions))}
 if(c.tests?.length){
  root.append(make('h2','','Diagnostic evidence'));
  for(const item of c.tests)row(item.name,item.result+(item.note?' — '+item.note:''))
 }
 if(c.summary){root.append(make('h2','','Conclusions and next steps'),make('p','',c.summary))}
 row('Entered estimated expenses',money.format(engine.totals(c.amounts).total));
 root.append(make('p','print-warning','All symptoms, codes, test results, estimates and case status are user-reported and not independently verified. Not a signed repair order, OBD scan, safety certification, proof of completed repairs or actual invoice.'));
 root.hidden=false
}
function printCase(c){
 writeReport(c);
 try{window.print()}catch{notice('Use Print or Save as PDF from your browser menu.')}
}
function csvCell(value){let s=text(value,1500);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function download(name,body,type){
 const blob=new Blob([body],{type}),uri=URL.createObjectURL(blob),link=document.createElement('a');link.href=uri;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(uri),2500)
}
function backup(){
 if(!cases.length){notice('No diagnostic cases to back up.');return}
 const data={app:'ravrent-mechanic',format:FORMAT,version:1,created:new Date().toISOString(),records:cases};
 download('ravrent-casebook-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');notice('Case backup exported. Keep it secure.')
}
function csvExport(){
 if(!cases.length){notice('No cases to export.');return}
 const lines=[['Issue','Vehicle','VIN','Mileage','Status','Codes','UrgentFlag','TestCount','EstimateTotal','Updated']];
 for(const c of cases){lines.push([c.name,c.vehicle,c.vin,c.miles,c.status,c.codes.join(' '),engine.triage(c.flags).high?'reported':'no',c.tests.length,engine.totals(c.amounts).total,c.updated.slice(0,10)])}
 download('ravrent-cases-'+new Date().toISOString().slice(0,10)+'.csv','\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
 notice('Case CSV exported. Do not treat recorded test results as independently verified.')
}
async function restore(file){
 if(!file)return;
 if(file.size>2*1024*1024){notice('Backup exceeds 2 MB.');return}
 try{
  const payload=JSON.parse(await file.text());
  if(payload?.app!=='ravrent-mechanic'||payload.format!==FORMAT||payload.version!==1||!Array.isArray(payload.records)||!payload.records.length||payload.records.length>180)throw Error('Unrecognized diagnostic backup');
  const incoming=payload.records.map(item=>{const normalized=engine.normalizeCase(item);if(!item.id||!item.created||!item.updated)throw Error('Case identification is missing.');return {...normalized,id:text(item.id,100),created:text(item.created,40),updated:text(item.updated,40)}});
  const ids=new Set(cases.map(c=>c.id));
  const newRecords=incoming.filter(c=>{if(ids.has(c.id))return false;ids.add(c.id);return true});if(!newRecords.length){notice('The backup has already been restored.');return}
  if(cases.length+newRecords.length>180)throw Error('Restore exceeds the 180-case local limit.');
  if(!confirm('Import '+newRecords.length+' additional diagnostic cases? Existing cases will be preserved.'))return;
  const previous=cases;cases=[...newRecords,...cases];if(!persist()){cases=previous;throw Error('Browser storage is full.')}
  render();notice(newRecords.length+' diagnostic cases imported without overwriting existing cases.')
 }catch(e){notice('Restore failed: '+(e.message||'Invalid file'))}
}
function aiReview(){
 const entry=readForm();if(!entry)return;
 try{sessionStorage.setItem('ravrent_ai_intake_v1',JSON.stringify({source:'casebook',question:engine.exportReview(entry),created:Date.now()}));location.href='/'}
 catch{$('caseFeedback').textContent='Cannot open AI handoff. You can copy the case notes manually.'}
}
function startEstimate(){
 const c=readForm();if(!c)return;
 const note=[c.name,c.symptoms,c.summary].filter(Boolean).join('\n').slice(0,1300);
 try{sessionStorage.setItem('ravrent_workshop_intake_v1',JSON.stringify({vehicle:c.vehicle,vin:c.vin,note}));location.href='/workshop.html'}
 catch{$('caseFeedback').textContent='Unable to start estimate. Open Workshop Estimates manually.'}
}
function importFromVin(){
 try{const raw=sessionStorage.getItem('ravrent_casebook_intake_v1');if(!raw)return;
  sessionStorage.removeItem('ravrent_casebook_intake_v1');
  const input=JSON.parse(raw),vin=String(input?.vin||'').toUpperCase(),vehicle=text(input?.vehicle,160);
  if(input?.created&&Date.now()-Number(input.created)>15*60*1000)return;
  if((vin&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))||!vehicle)return;
  open({vehicle,vin,name:'Pre-purchase inspection',status:'open',symptoms:'',conditions:'',codes:[],tests:[{name:'Document visual inspection and scan findings',result:'planned'}]});
  $('caseFeedback').textContent='VIN research transferred. Confirm the vehicle and record only evidence you have actually checked.'
 }catch{}
}
$('newCase').addEventListener('click',()=>open());
$('closeCase').addEventListener('click',()=>els.dialog.close());
$('caseForm').addEventListener('submit',e=>{e.preventDefault();save()});
$('caseVin').addEventListener('input',()=>{$('caseVin').value=$('caseVin').value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,'').slice(0,17)});
$('addCaseTest').addEventListener('click',()=>{if($('caseTests').children.length>=25){$('caseFeedback').textContent='Maximum 25 diagnostic tests per case.';return}buildTestRow()});
$('caseHazards').addEventListener('change',updateSafety);
for(const key of ['costDiagnostic','costParts','costLabor','costOther'])$(key).addEventListener('input',costPreview);
$('caseSearch').addEventListener('input',render);
document.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.stage;document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(button===b)));render()}));
$('casesCsv').addEventListener('click',csvExport);$('casesBackup').addEventListener('click',backup);
$('casesImportButton').addEventListener('click',()=>$('casesImport').click());
$('casesImport').addEventListener('change',async event=>{const file=event.target.files?.[0];event.target.value='';await restore(file)});
$('caseAI').addEventListener('click',aiReview);$('caseToWorkshop').addEventListener('click',startEstimate);
$('deleteCase').addEventListener('click',()=>{
 const c=cases.find(x=>x.id===editing);if(!c||!confirm('Delete the case "'+c.name+'"? This cannot be undone without a backup.'))return;
 const previous=cases;cases=cases.filter(x=>x.id!==c.id);if(!persist()){cases=previous;$('caseFeedback').textContent='Unable to delete. Check browser storage.';return}
 els.dialog.close();editing=null;render();notice('Case deleted.')
});
$('duplicateCase').addEventListener('click',()=>{
 const c=cases.find(x=>x.id===editing);if(!c)return;
 open({...c,id:'',name:c.name+' (copy)',status:'open',created:'',updated:''});
 $('caseFeedback').textContent='Unsaved copy: results remain as entered. Verify findings and save as a new case.'
});
$('printCase').addEventListener('click',()=>{const c=cases.find(x=>x.id===editing);if(c)printCase(c)});
window.addEventListener('afterprint',()=>{$('casePrint').hidden=true});
load();render();importFromVin();
})();