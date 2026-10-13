(()=>{'use strict';
const $=id=>document.getElementById(id);
const DB='ravrent_reseller_inventory_v1',INTAKE='ravrent_reseller_intake_v1';
const costs=['purchase','buyerFees','transport','parts','labor','detailing','paperwork','other'];
const inspections=[['vinIdentity','VIN plates and paperwork match'],['titleEvidence','Title, liens and seller identity'],['body','Body, frame and structural damage'],['paint','Paint, panel fit and evidence of repairs'],['engine','Engine operation and fluid leaks'],['transmission','Transmission and driveline'],['suspension','Suspension, steering and handling'],['brakes','Brakes, tires and wheels'],['electrical','Electrical systems and warning lamps'],['obd','OBD codes and emissions readiness'],['road','Road test and operating temperature'],['recalls','VIN-specific recall evidence']];
const inspectStates={untested:'Not inspected',pass:'Checked — satisfactory',concern:'Needs further inspection',fail:'Issue confirmed'};
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const fullMoney=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2});
const fields=['formVin','formYear','formMake','formModel','formTrim','formMileage','formStage',...costs,'asking','desiredProfit','actualSale','formNotes'];
const numeric=['formYear','formMileage',...costs,'asking','desiredProfit','actualSale'];
const stages={considering:'Researching',purchased:'Purchased',reconditioning:'Reconditioning',listed:'Listed',sold:'Sold'};
let inventory=[],editingId=null,activeFilter='all';
const safe=(x,max=3000)=>String(x===null||x===undefined?'':x).slice(0,max);
const value=(id)=>$(id).value.trim();
const number=(x)=>{const n=Number(x);return Number.isFinite(n)&&n>=0?n:0};
const hasNumber=(x)=>x!==''&&x!==null&&x!==undefined&&Number.isFinite(Number(x));
const sumCost=(v)=>costs.reduce((total,k)=>total+number(v[k]),0);
const saleValue=(v)=>v.stage==='sold'&&hasNumber(v.actualSale)?number(v.actualSale):hasNumber(v.asking)?number(v.asking):null;
const fmt=(n)=>money.format(Number.isFinite(n)?n:0);
const label=(v)=>[v.year,v.make,v.model,v.trim].filter(Boolean).join(' ')||'Unnamed vehicle';
function load(){
 try{const data=JSON.parse(localStorage.getItem(DB)||'[]');inventory=Array.isArray(data)?data.filter(x=>x&&typeof x==='object'&&typeof x.id==='string').slice(0,300):[]}catch{inventory=[]}
}
function persist(){
 try{localStorage.setItem(DB,JSON.stringify(inventory));return true}catch{return false}
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
function metrics(){
 $('vehicleCount').textContent=String(inventory.length);
 const owned=inventory.filter(v=>v.stage!=='considering'&&v.stage!=='sold');
 $('capitalTotal').textContent=fmt(owned.reduce((a,v)=>a+sumCost(v),0));
 $('profitTotal').textContent=fmt(owned.reduce((a,v)=>{const s=saleValue(v);return s===null?a:a+s-sumCost(v)},0));
 $('soldTotal').textContent=fmt(inventory.filter(v=>v.stage==='sold'&&hasNumber(v.actualSale)).reduce((a,v)=>a+number(v.actualSale)-sumCost(v),0));
}
function render(){
 metrics();const host=$('inventoryList');host.replaceChildren();
 const query=value('search').toLowerCase();
 const data=inventory.filter(v=>(activeFilter==='all'||v.stage===activeFilter)&&(!query||[v.vin,label(v),v.notes].join(' ').toLowerCase().includes(query))).sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')));
 if(!data.length){
  const box=el('div','empty'),h=el('h3','',inventory.length?'No matching vehicles':'Your inventory is ready'),p=el('p','',inventory.length?'Change the filter or search to see other vehicles.':'Add a vehicle or transfer a decoded VIN from Vehicle Intelligence. Track acquisition costs, reconditioning and projected margins.');
  box.append(h,p);if(!inventory.length){const button=el('button','primary','Add first vehicle');button.onclick=()=>open();box.append(button)}host.append(box);return
 }
 for(const v of data){
  const card=el('article','inventory-card'),left=el('div'),right=el('div','inventory-actions');
  const stage=el('span','stage '+safe(v.stage,30),stages[v.stage]||'Researching');
  const title=el('h3','',label(v)),meta=el('div','meta',(v.vin?'VIN '+v.vin+' · ':'')+(v.mileage?Number(v.mileage).toLocaleString('en-US')+' mi':'Mileage not recorded'));
  left.append(stage,title,meta);
  const review=Object.values(v.inspection||{}),recorded=review.filter(x=>x!=='untested').length,flagged=review.filter(x=>x==='concern'||x==='fail').length;
  if(recorded){left.append(el('div','inspect-summary',recorded+'/'+inspections.length+' owner inspection areas recorded'+(flagged?' · '+flagged+' concern(s)':' · no reported concerns')))}
  const nums=el('div','numbers');
  const cost=sumCost(v),sale=saleValue(v);
  for(const [name,amount] of [['Direct costs',fmt(cost)],[v.stage==='sold'?'Sale amount':'Target sale',sale===null?'Not entered':fmt(sale)],['Gross '+(v.stage==='sold'?'profit':'projected profit'),sale===null?'—':fmt(sale-cost)]]){
   const cell=el('div'),key=el('span','',name),val=el('strong','',amount);
   if(name.startsWith('Gross')&&sale!==null)val.className=sale-cost>=0?'profit-positive':'profit-negative';
   cell.append(key,val);nums.append(cell)
  }
  left.append(nums);
  const edit=el('button','','Open worksheet');edit.type='button';edit.onclick=()=>open(v.id);
  const vin=el('a','','Vehicle research');vin.href='/vin-report.html'+(v.vin?'?vin='+encodeURIComponent(v.vin):'');
  const report=el('button','','Print report');report.type='button';report.onclick=()=>printReportFor(v);
  right.append(edit,report,vin);card.append(left,right);host.append(card)
 }
}
function getForm(){
 const record={};for(const id of fields){const key=id.startsWith('form')?id==='formVin'?'vin':id==='formYear'?'year':id==='formMake'?'make':id==='formModel'?'model':id==='formTrim'?'trim':id==='formMileage'?'mileage':id==='formStage'?'stage':id==='formNotes'?'notes':id:id;record[key]=numeric.includes(id)?value(id):safe(value(id),id==='formNotes'?3000:100)}
 record.inspection={};for(const [key] of inspections){const control=document.getElementById('inspect-'+key);record.inspection[key]=inspectStates[control?.value]?control.value:'untested'}
 return record
}
function fill(record){
 const ids={formVin:'vin',formYear:'year',formMake:'make',formModel:'model',formTrim:'trim',formMileage:'mileage',formStage:'stage',formNotes:'notes'};
 for(const id of fields){const key=ids[id]||id;$(id).value=record&&record[key]!==undefined?String(record[key]):id==='formStage'?'considering':''}
 for(const [key] of inspections){const control=document.getElementById('inspect-'+key);if(control)control.value=inspectStates[record?.inspection?.[key]]?record.inspection[key]:'untested'}
 updateMath();
}
function updateMath(){
 const v=getForm(),total=sumCost(v),sale=saleValue(v),profit=sale===null?null:sale-total;
 $('formTotalCost').textContent=fullMoney.format(total);
 $('formProfitLabel').textContent=v.stage==='sold'?'Recorded gross profit':'Projected gross profit';
 $('formProfit').textContent=profit===null?'—':fullMoney.format(profit);
 $('formProfit').className=profit===null?'':profit>=0?'profit-positive':'profit-negative';
 $('formRoi').textContent=profit===null||total<=0?'—':(100*profit/total).toFixed(1)+'%';
 const asking=hasNumber(v.asking)?Number(v.asking):null;
 const maxOffer=asking!==null&&hasNumber(v.desiredProfit)?asking-(total-number(v.purchase))-number(v.desiredProfit):null;
 $('formMaxOffer').textContent=maxOffer===null?'—':fullMoney.format(maxOffer);
 $('formMaxOffer').className=maxOffer===null?'':maxOffer>=0?'profit-positive':'profit-negative';
 const values=Object.values(v.inspection||{});const complete=values.filter(x=>x!=='untested').length;
 const flagged=values.filter(x=>x==='concern'||x==='fail').length;
 $('inspectionSummary').textContent=complete+' of '+inspections.length+' inspection areas recorded; '+flagged+' flagged for review. Owner-reported, not independently verified.';
}
function open(id=null,intake=null){
 editingId=id;
 const record=inventory.find(v=>v.id===id)||intake||null;
 $('vehicleForm').reset();fill(record);
 $('dialogTitle').textContent=id?'Edit inventory vehicle':'Add inventory vehicle';
 $('deleteVehicle').hidden=!id;
 $('printVehicle').hidden=!id;
 $('formStatus').textContent='';
 $('decodeStatus').textContent=intake?'Vehicle details imported from VIN Intelligence. Check all information before saving.':'';
 $('vehicleDialog').showModal();
}
async function decode(){
 const vin=value('formVin').toUpperCase();
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)){$('decodeStatus').textContent='Enter a complete 17-character VIN first.';return}
 const button=$('lookupVin');button.disabled=true;$('decodeStatus').textContent='Decoding VIN with NHTSA…';
 try{
  const reply=await fetch('/api/vin?vin='+encodeURIComponent(vin),{cache:'no-store'});
  const data=await reply.json();if(!reply.ok)throw Error(data.error||'Lookup unavailable');
  $('formVin').value=vin;$('formYear').value=data.year;$('formMake').value=data.make;$('formModel').value=data.model;$('formTrim').value=[data.trim,data.engine].filter(Boolean).join(' · ').slice(0,100);
  $('decodeStatus').textContent='Manufacturer vehicle details filled in. Accident, title and recall status are not verified.';
 }catch(e){$('decodeStatus').textContent=e.message||'VIN lookup unavailable'}
 finally{button.disabled=false}
}
function validate(v){
 if(v.vin&& !/^[A-HJ-NPR-Z0-9]{17}$/.test(v.vin))return 'VIN must contain exactly 17 valid characters, or be left blank.';
 if(!v.year||!Number.isInteger(Number(v.year))||Number(v.year)<1900||Number(v.year)>2035)return 'Enter a valid model year.';
 if(!v.make||!v.model)return 'Year, make and model are required.';
 if(!stages[v.stage])return 'Select a valid inventory stage.';
 for(const k of [...costs,'asking','desiredProfit','actualSale']){
  if(v[k]==='')continue;
  if(!Number.isFinite(Number(v[k]))||Number(v[k])<0||Number(v[k])>100000000)return 'Amounts must be between $0 and $100 million.'
 }
 if(v.mileage!==''&&(!Number.isInteger(Number(v.mileage))||Number(v.mileage)<0||Number(v.mileage)>9999999))return 'Mileage must be a whole number.';
 if(v.stage==='sold'&&!hasNumber(v.actualSale))return 'Enter the actual final sale price before marking a vehicle as sold.';
 for(const [key] of inspections){if(!inspectStates[v.inspection?.[key]])return 'Invalid inspection state.';}
 return null
}
function save(){
 const v=getForm();v.vin=v.vin.toUpperCase();v.year=String(v.year);
 const error=validate(v);if(error){$('formStatus').textContent=error;return}
 if(!editingId&&inventory.length>=300){$('formStatus').textContent='This browser currently supports up to 300 inventory vehicles. Export before removing old records.';return}
 const duplicate=inventory.find(x=>v.vin&&x.vin===v.vin&&x.id!==editingId);
 if(duplicate){$('formStatus').textContent='This VIN is already in inventory. Open its existing worksheet.';return}
 const old=inventory.find(x=>x.id===editingId);
 const id=editingId||(globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2));
 const next={...v,id,created:old?.created||new Date().toISOString(),updated:new Date().toISOString()};
 const previous=inventory;
 inventory=editingId?inventory.map(x=>x.id===editingId?next:x):[next,...inventory];
 if(!persist()){inventory=previous;$('formStatus').textContent='Unable to save in browser storage. Export your data or free space.';return}
 $('vehicleDialog').close();editingId=null;render()
}
function download(name,data,type){
 const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)
}
function csvCell(v){let text=safe(v,3000);if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}
function exportCsv(){
 if(!inventory.length){$('inventoryHint').textContent='Add at least one vehicle before exporting.';return}
 const keys=['vin','year','make','model','trim','mileage','stage',...costs,'asking','desiredProfit','actualSale','notes','created','updated'];
 const out=[...keys,'directCostTotal','grossProfit','roiPercent',...inspections.map(([key])=>'inspection_'+key)];
 const rows=[out.map(csvCell).join(',')];
 for(const v of inventory){
  const cost=sumCost(v),sale=saleValue(v),profit=sale===null?'':(sale-cost).toFixed(2),roi=sale===null||cost===0?'':(100*(sale-cost)/cost).toFixed(2);
  rows.push([...keys.map(k=>v[k]??''),cost.toFixed(2),profit,roi,...inspections.map(([key])=>v.inspection?.[key]||'untested')].map(csvCell).join(','))
 }
 download('ravrent-reseller-inventory-'+new Date().toISOString().slice(0,10)+'.csv','\uFEFF'+rows.join('\r\n'),'text/csv;charset=utf-8');
 $('inventoryHint').textContent='CSV exported. This browser remains the primary copy unless you back it up.';
}

function buildInspection(){
 const host=$('inspectionGrid');host.replaceChildren();
 for(const [key,name] of inspections){
  const item=el('label','inspection-item');
  const title=el('span','',name);
  const select=el('select');select.id='inspect-'+key;select.dataset.inspect=key;
  for(const [option,label] of Object.entries(inspectStates)){const node=el('option','',label);node.value=option;select.append(node)}
  select.value='untested';select.addEventListener('change',updateMath);item.append(title,select);host.append(item)
 }
}
function backupJson(){
 if(!inventory.length){$('inventoryHint').textContent='Add a vehicle before creating a backup.';return}
 const snapshot={app:'ravrent-mechanic',format:'reseller-inventory',version:1,createdAt:new Date().toISOString(),records:inventory};
 download('ravrent-reseller-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(snapshot,null,2),'application/json;charset=utf-8');
 $('inventoryHint').textContent='Backup exported. Keep your JSON file somewhere safe; data is not cloud-synced.'
}
function normalizedRecord(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 const record={id:safe(v.id,100),vin:safe(v.vin,17).toUpperCase(),year:safe(v.year,4),make:safe(v.make,60),model:safe(v.model,80),trim:safe(v.trim,100),mileage:safe(v.mileage,12),stage:safe(v.stage,30),asking:safe(v.asking,20),desiredProfit:safe(v.desiredProfit,20),actualSale:safe(v.actualSale,20),notes:safe(v.notes,3000),created:safe(v.created,40),updated:safe(v.updated,40),inspection:{}};
 for(const key of costs)record[key]=safe(v[key],20);
 for(const [key] of inspections)record.inspection[key]=inspectStates[v.inspection?.[key]]?v.inspection[key]:'untested';
 if(!record.id||validate(record))return null;
 return record
}
async function restoreJson(file){
 if(!file)return;
 if(file.size>2*1024*1024){$('inventoryHint').textContent='Backup file is over the 2 MB limit.';return}
 try{
  const data=JSON.parse(await file.text());
  if(data?.app!=='ravrent-mechanic'||data?.format!=='reseller-inventory'||data?.version!==1||!Array.isArray(data.records)||data.records.length>300||data.records.length===0)throw Error('Not a valid Ravrent reseller backup');
  const valid=data.records.map(normalizedRecord);
  if(valid.some(x=>!x))throw Error('Backup includes invalid or unsupported vehicle records');
  const ids=new Set(inventory.map(x=>x.id)),vins=new Set(inventory.filter(x=>x.vin).map(x=>x.vin));
  const additions=[];
  for(const record of valid){if(ids.has(record.id)||(record.vin&&vins.has(record.vin)))continue;ids.add(record.id);if(record.vin)vins.add(record.vin);additions.push(record)}
  if(!additions.length){$('inventoryHint').textContent='All backup vehicles already exist here; nothing changed.';return}
  if(inventory.length+additions.length>300)throw Error('Import would exceed the 300-vehicle local storage limit');
  if(!confirm('Import '+additions.length+' new vehicle records? Existing vehicles will not be overwritten.'))return;
  const old=inventory;inventory=[...additions,...inventory];
  if(!persist()){inventory=old;throw Error('Not enough browser storage to restore this backup')}
  render();$('inventoryHint').textContent=additions.length+' vehicles restored from backup. Existing vehicle records were preserved.';
 }catch(e){$('inventoryHint').textContent='Restore failed: '+(e.message||'Invalid backup file')}
}
function printReportFor(v){
 const report=$('printReport');report.replaceChildren();
 report.append(el('h1','','Ravrent Mechanic — Vehicle Acquisition & Inspection'));
 report.append(el('p','print-meta','Prepared '+new Date().toLocaleString('en-US')+' · Vehicle record is user-entered, not independently verified'));
 const heading=(text)=>report.append(el('h2','',text));
 const line=(name,data)=>{const item=el('div','print-row');item.append(el('span','',name),el('strong','',String(data)));report.append(item)};
 heading('Vehicle identity');
 line('Vehicle',label(v));line('VIN',v.vin||'Not entered');line('Odometer',v.mileage?v.mileage+' miles (reported)':'Not provided');line('Pipeline stage',stages[v.stage]||'Not specified');
 heading('Acquisition and sale');
 const cost=sumCost(v),sale=saleValue(v);
 for(const [key,name] of [['purchase','Purchase price'],['buyerFees','Buyer fees'],['transport','Transport'],['parts','Parts'],['labor','Labor'],['detailing','Detailing'],['paperwork','Title / fees'],['other','Other direct costs']])line(name,fullMoney.format(number(v[key])));
 line('Total direct costs',fullMoney.format(cost));line(v.stage==='sold'?'Actual sale price':'Target asking price',sale===null?'Not entered':fullMoney.format(sale));
 line('Gross '+(v.stage==='sold'?'profit':'projected profit'),sale===null?'Cannot calculate':fullMoney.format(sale-cost));
 heading('Inspection — user-entered');
 for(const [key,name] of inspections)line(name,inspectStates[v.inspection?.[key]]||inspectStates.untested);
 heading('Evidence, concerns and notes');
 report.append(el('p','print-notes',v.notes||'No owner notes recorded.'));
 heading('Report limitations');
 report.append(el('p','print-notes','This is a user-entered acquisition and inspection worksheet, NOT a CARFAX or verified vehicle-history report. It does not independently establish title status, accident history, odometer accuracy, liens, VIN-specific recall eligibility, completed recall repairs, or mechanical condition. Reported profit excludes unentered fees, financing, taxes, overhead and other liabilities.'));
 report.hidden=false;
 $('vehicleDialog').close();
 if(typeof window.print==='function')window.print();
}
function initIntake(){
 let intake=null;try{intake=JSON.parse(sessionStorage.getItem(INTAKE)||'null');sessionStorage.removeItem(INTAKE)}catch{}
 if(intake&&typeof intake==='object'&&/^[A-HJ-NPR-Z0-9]{17}$/.test(safe(intake.vin,40))){open(null,{vin:intake.vin,year:safe(intake.year,4),make:safe(intake.make,60),model:safe(intake.model,80),trim:safe(intake.trim,100),stage:'considering'})}
}
$('addVehicle').addEventListener('click',()=>open());
$('lookupVin').addEventListener('click',decode);
$('closeDialog').addEventListener('click',()=>$('vehicleDialog').close());
$('vehicleForm').addEventListener('submit',e=>{e.preventDefault();save()});
$('vehicleDialog').addEventListener('close',()=>{editingId=null});
$('deleteVehicle').addEventListener('click',()=>{
 if(!editingId)return;
 const v=inventory.find(x=>x.id===editingId);if(!v)return;
 if(!confirm('Permanently remove '+label(v)+' from this browser inventory?'))return;
 const old=inventory;inventory=inventory.filter(x=>x.id!==editingId);
 if(!persist()){inventory=old;$('formStatus').textContent='Unable to remove record from storage.';return}
 $('vehicleDialog').close();editingId=null;render()
});
$('vehicleForm').addEventListener('input',e=>{if(e.target.matches('input,select'))updateMath()});
$('vehicleForm').addEventListener('change',updateMath);
$('formVin').addEventListener('input',()=>{$('formVin').value=$('formVin').value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,'').slice(0,17)});
$('search').addEventListener('input',render);
$('exportCsv').addEventListener('click',exportCsv);
$('backupJson').addEventListener('click',backupJson);
$('restoreButton').addEventListener('click',()=>$('restoreJson').click());
$('restoreJson').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';await restoreJson(file)});
$('printVehicle').addEventListener('click',()=>{const v=inventory.find(x=>x.id===editingId);if(v)printReportFor(v)});
window.addEventListener('afterprint',()=>{$('printReport').hidden=true});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 activeFilter=button.dataset.filter;
 document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));render()
}));
buildInspection();load();render();initIntake();
})();