(()=>{'use strict';
const $=id=>document.getElementById(id),core=window.RavrentWorkshopCore;
if(!core)return;
const KEY='ravrent_workshop_estimates_v1',STAGES={draft:'Draft',quoted:'Quoted',approved:'Customer approved',progress:'In progress',completed:'Completed'};
const flds=['shopName','shopContact','customerName','customerContact','customerVehicle','quoteVin','quoteMiles','quoteStage','quoteTax','quoteDiscount','quoteDeposit','quoteExpiry','quoteNotes','quoteTerms'];
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const compact=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const date=()=>new Date().toISOString().slice(0,10);
const text=(v,n=200)=>String(v===undefined||v===null?'':v).slice(0,n);
const get=id=>String($(id).value||'').trim();
const make=(tag,cls,content)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el};
const id=()=>window.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,11);
let records=[],editing=null,filter='all';
function notify(message){$('workshopStatus').textContent=message}
function load(){
 try{const items=JSON.parse(localStorage.getItem(KEY)||'[]');records=Array.isArray(items)?items.filter(v=>v&&typeof v==='object'&&typeof v.id==='string').slice(0,200):[]}catch{records=[]}
}
function saveStorage(){
 try{localStorage.setItem(KEY,JSON.stringify(records));return true}catch{return false}
}
function linesUI(){return [...$('quoteLines').querySelectorAll('.estimate-line')]}
function createInput(field,type,value,placeholder){
 const input=make('input');input.dataset.field=field;input.type=type;input.value=value===undefined?'':String(value);
 if(placeholder)input.placeholder=placeholder;
 if(type==='number'){input.min='0';input.step=field==='quantity'?'0.25':'0.01';input.max=field==='quantity'?'10000':'1000000';input.inputMode='decimal'}
 if(field==='description')input.maxLength=160;
 return input
}
function field(labelName,input){
 const label=make('label');label.append(make('span','',labelName),input);return label
}
function addItem(record={}){
 const container=make('div','estimate-line'),top=make('div','line-top');
 const caption=make('span','line-index','ITEM '+($('quoteLines').children.length+1));
 const remove=make('button','line-remove','Remove');remove.type='button';remove.setAttribute('aria-label','Remove line item');remove.addEventListener('click',()=>{
  if(linesUI().length===1){notify('At least one item is required.');return}container.remove();renumber();totals()
 });
 top.append(caption,remove);
 const fields=make('div','line-fields'),selector=make('select');selector.dataset.field='kind';
 for(const [val,label] of [['labor','Labor'],['part','Part'],['fee','Shop fee']]){const opt=make('option','',label);opt.value=val;selector.append(opt)}
 selector.value=['labor','part','fee'].includes(record.kind)?record.kind:'labor';
 fields.append(field('Work type',selector),
  field('Description',createInput('description','text',record.description||'','Diagnosis, replacement…')),
  field('Qty / hrs',createInput('quantity','number',record.quantity??1)),
  field('Customer rate ($)',createInput('unitPrice','number',record.unitPrice??0)),
  field('Internal unit cost ($)',createInput('internalCost','number',record.internalCost??0)));
 const footer=make('div','line-top');
 const tax=make('label','line-tax'),check=make('input');check.type='checkbox';check.dataset.field='taxable';check.checked=record.taxable===true;
 tax.append(check,make('span','','Taxable item'));
 const amount=make('strong','line-total','$0.00');footer.append(tax,amount);
 container.append(top,fields,footer);
 container.addEventListener('input',totals);
 container.addEventListener('change',totals);
 $('quoteLines').append(container);
 totals();return container
}
function renumber(){linesUI().forEach((el,i)=>el.querySelector('.line-index').textContent='ITEM '+(i+1))}
function readLines(){
 return linesUI().map(line=>{
  const v=name=>line.querySelector('[data-field="'+name+'"]');
  return {kind:v('kind').value,description:v('description').value.trim(),quantity:v('quantity').value,unitPrice:v('unitPrice').value,internalCost:v('internalCost').value,taxable:v('taxable').checked};
 })
}
function getForm(){
 const obj={};
 for(const key of flds)obj[key]=get(key);
 obj.items=readLines();return obj
}
function calculate(form){return core.calculate({items:form.items,discount:form.quoteDiscount,taxRate:form.quoteTax,depositPercent:form.quoteDeposit})}
function totals(){
 try{
  const form=getForm(),calc=calculate(form);
  $('subTotal').textContent=usd.format(calc.subtotal);
  $('taxTotal').textContent=usd.format(calc.tax);
  $('customerTotal').textContent=usd.format(calc.total);
  $('depositTotal').textContent=usd.format(calc.deposit);
  $('marginTotal').textContent=usd.format(calc.estimatedGrossMargin);
  $('marginTotal').className=calc.estimatedGrossMargin<0?'profit-negative':'profit-positive';
  linesUI().forEach((line,i)=>{const item=form.items[i],quantity=Number(item.quantity),price=Number(item.unitPrice);line.querySelector('.line-total').textContent=Number.isFinite(quantity*price)?usd.format(quantity*price):'Invalid amount'});
  return calc
 }catch(e){for(const key of ['subTotal','taxTotal','customerTotal','depositTotal','marginTotal'])$(key).textContent='—';return null}
}
function validate(v){
 if(!v.shopName||!v.customerName||!v.customerVehicle)return 'Shop name, customer name and vehicle are required.';
 if(!STAGES[v.quoteStage])return 'Choose a valid job stage.';
 if(v.quoteVin&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(v.quoteVin))return 'VIN must be 17 valid characters or blank.';
 if(v.quoteMiles!==''&&(!Number.isInteger(Number(v.quoteMiles))||Number(v.quoteMiles)<0||Number(v.quoteMiles)>9999999))return 'Mileage must be a nonnegative whole number.';
 if(v.quoteExpiry&&!/^\d{4}-\d{2}-\d{2}$/.test(v.quoteExpiry))return 'Use a valid expiration date.';
 if(v.items.length<1||v.items.length>40)return 'Add between 1 and 40 line items.';
 for(const item of v.items){
  if(!['labor','part','fee'].includes(item.kind)||!item.description)return 'Each line needs a type and description.';
  if(item.description.length>160)return 'Line description is too long.';
  const qty=Number(item.quantity),price=Number(item.unitPrice),cost=Number(item.internalCost);
  if(!Number.isFinite(qty)||qty<=0||qty>10000||!Number.isFinite(price)||price<0||price>1000000||!Number.isFinite(cost)||cost<0||cost>1000000)return 'Item quantity, rates and unit costs must be valid nonnegative amounts.';
 }
 try{calculate(v)}catch(e){return e.message||'Invalid estimate totals'}
 return ''
}
function savedShop(){
 const latest=records.find(x=>x.shopName);
 return {shopName:latest?.shopName||'',shopContact:latest?.shopContact||'',quoteTax:latest?.quoteTax||'0',quoteTerms:latest?.quoteTerms||''}
}
function fill(v){
 $('quoteForm').reset();
 const defaults=savedShop();
 for(const field of flds)$(field).value=text(v?.[field]??defaults[field]??'',field==='quoteNotes'?4000:field==='quoteTerms'?2000:180);
 $('quoteStage').value=v?.quoteStage||'draft';
 $('quoteLines').replaceChildren();
 const items=v?.items?.length?v.items:[{kind:'labor',description:'',quantity:1,unitPrice:0,internalCost:0,taxable:false}];
 for(const item of items.slice(0,40))addItem(item);
 totals()
}
function open(record=null){
 editing=record?.id||null;fill(record);
 $('quoteTitle').textContent=record?'Edit '+record.number:'New customer estimate';
 $('deleteQuote').hidden=!record;$('duplicateQuote').hidden=!record;$('printQuote').hidden=!record;
 $('quoteFeedback').textContent='';
 $('quoteDialog').showModal()
}
function normalized(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 const obj={};for(const key of flds)obj[key]=text(v[key],key==='quoteNotes'?4000:key==='quoteTerms'?2000:180);
 obj.quoteVin=obj.quoteVin.toUpperCase();
 obj.items=(Array.isArray(v.items)?v.items:[]).slice(0,40).map(item=>({
  kind:text(item?.kind,16),description:text(item?.description,160),quantity:text(item?.quantity,22),unitPrice:text(item?.unitPrice,22),internalCost:text(item?.internalCost,22),taxable:item?.taxable===true
 }));
 if(validate(obj))return null;
 obj.id=text(v.id,120);obj.number=text(v.number,80);obj.created=text(v.created,40);obj.updated=text(v.updated,40);
 return obj.id&&obj.number?obj:null
}
function persistForm(){
 const v=getForm();v.quoteVin=v.quoteVin.toUpperCase();const error=validate(v);
 if(error){$('quoteFeedback').textContent=error;return}
 if(!editing&&records.length>=200){$('quoteFeedback').textContent='200 estimates is the local limit. Export and archive records before adding more.';return}
 const old=records.find(x=>x.id===editing);
 const quote={...v,id:old?.id||id(),number:old?.number||'RM-'+date().replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),created:old?.created||new Date().toISOString(),updated:new Date().toISOString()};
 const before=records;records=editing?records.map(x=>x.id===editing?quote:x):[quote,...records];
 if(!saveStorage()){records=before;$('quoteFeedback').textContent='Browser storage is full. Export a backup before continuing.';return}
 $('quoteDialog').close();editing=null;render();notify('Estimate '+quote.number+' saved on this device. No customer message or payment was sent.')
}
function stateTotals(){let openTotal=0;for(const v of records){if(['quoted','approved','progress'].includes(v.quoteStage)){try{openTotal+=calculate(v).total}catch{}}}
 $('quoteCount').textContent=String(records.length);$('quotedTotal').textContent=compact.format(openTotal);
 $('approvedCount').textContent=String(records.filter(x=>['approved','progress'].includes(x.quoteStage)).length);
 $('completedCount').textContent=String(records.filter(x=>x.quoteStage==='completed').length)
}
function render(){
 stateTotals();const list=$('quoteList');list.replaceChildren();
 const search=get('quoteSearch').toLowerCase();
 const shown=records.filter(x=>(filter==='all'||x.quoteStage===filter)&&(!search||[x.customerName,x.customerVehicle,x.number,x.shopName].join(' ').toLowerCase().includes(search))).sort((a,b)=>b.updated.localeCompare(a.updated));
 if(!shown.length){const box=make('div','empty'),heading=make('h3','',records.length?'Nothing matches that filter':'Ready for the first estimate'),p=make('p','',records.length?'Try another search or status.':'Create an itemized quote, include labor and parts, and print a clean customer estimate. No card processing is connected.');box.append(heading,p);if(!records.length){const start=make('button','primary','Create first estimate');start.onclick=()=>open();box.append(start)}list.append(box);return}
 for(const quote of shown){
  const card=make('article','estimate-card'),info=make('div'),actions=make('div','estimate-actions');
  const stage=make('span','estimate-stage '+quote.quoteStage,STAGES[quote.quoteStage]||'Draft');
  const name=make('h3','',quote.customerVehicle||'Vehicle');
  const customer=make('p','',quote.customerName+' · '+quote.number);
  const bottom=make('div','meta-line','Updated '+new Date(quote.updated).toLocaleDateString('en-US')+' · '+(quote.items?.length||0)+' item(s)');
  let amount='—';try{amount=usd.format(calculate(quote).total)}catch{}
  const total=make('div','amount',amount);info.append(stage,name,customer,total,bottom);
  const edit=make('button','','Open'),print=make('button','','Print / PDF');
  edit.type='button';print.type='button';edit.onclick=()=>open(quote);print.onclick=()=>printEstimate(quote);
  actions.append(edit,print);card.append(info,actions);list.append(card)
 }
}
function download(file,data,contentType){
 const blob=new Blob([data],{type:contentType}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500)
}
function csv(v){let s=text(v,500);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function exportCsv(){
 if(!records.length){notify('No estimates to export.');return}
 const keys=['number','created','updated','quoteStage','shopName','customerName','customerVehicle','quoteVin','quoteMiles','quoteExpiry'];
 const headers=[...keys,'subtotal','discount','tax','total','depositRequested','estimatedGrossMargin','itemCount'];
 const rows=[headers.map(csv).join(',')];
 for(const record of records){let c;try{c=calculate(record)}catch{continue}
  rows.push([...keys.map(k=>record[k]||''),c.subtotal,c.discount,c.tax,c.total,c.deposit,c.estimatedGrossMargin,record.items.length].map(csv).join(','))
 }
 download('ravrent-workshop-estimates-'+date()+'.csv','\uFEFF'+rows.join('\r\n'),'text/csv;charset=utf-8');
 notify('Estimates exported to CSV. Customer documents remain stored on this browser.')
}
function backup(){
 if(!records.length){notify('No estimates to back up.');return}
 const data={app:'ravrent-mechanic',format:'workshop-estimates',version:1,exported:new Date().toISOString(),records};
 download('ravrent-workshop-backup-'+date()+'.json',JSON.stringify(data,null,2),'application/json');
 notify('Workshop backup downloaded. Keep it secure: it may contain customer information.')
}
async function restore(file){
 if(!file)return;
 if(file.size>2*1024*1024){notify('Backup too large; maximum 2 MB.');return}
 try{
  const data=JSON.parse(await file.text());
  if(data?.app!=='ravrent-mechanic'||data?.format!=='workshop-estimates'||data?.version!==1||!Array.isArray(data.records)||!data.records.length||data.records.length>200)throw Error('Not a recognized Ravrent workshop backup');
  const parsed=data.records.map(normalized);
  if(parsed.some(x=>!x))throw Error('The backup contains invalid estimates.');
  const ids=new Set(records.map(x=>x.id)),numbers=new Set(records.map(x=>x.number)),added=[];
  for(const record of parsed){if(ids.has(record.id)||numbers.has(record.number))continue;added.push(record);ids.add(record.id);numbers.add(record.number)}
  if(!added.length){notify('Every backup estimate is already here. No changes made.');return}
  if(records.length+added.length>200)throw Error('Restore would exceed the 200-estimate browser limit.');
  if(!confirm('Restore '+added.length+' additional estimates? Existing records will not be overwritten.'))return;
  const previous=records;records=[...added,...records];
  if(!saveStorage()){records=previous;throw Error('Unable to save the imported records.')}
  render();notify(added.length+' estimates restored without overwriting existing records.')
 }catch(e){notify('Restore failed: '+(e.message||'Invalid file'))}
}
function printEstimate(quote){
 const area=$('workshopPrint');area.replaceChildren();
 const heading=make('h1','','REPAIR ESTIMATE'),line=(label,value)=>{const row=make('div','print-row');row.append(make('span','',label),make('strong','',String(value)));area.append(row)};
 area.append(heading,make('p','',quote.shopName+(quote.shopContact?' · '+quote.shopContact:'')));
 line('Estimate number',quote.number);line('Date',quote.created?.slice(0,10)||date());line('Customer',quote.customerName);
 if(quote.customerContact)line('Customer contact',quote.customerContact);
 line('Vehicle',quote.customerVehicle);
 if(quote.quoteVin)line('VIN',quote.quoteVin);
 if(quote.quoteMiles)line('Odometer',quote.quoteMiles+' miles (provided)');
 line('Status',STAGES[quote.quoteStage]+' (recorded manually)');
 if(quote.quoteExpiry)line('Valid through',quote.quoteExpiry);
 area.append(make('h2','','Itemized estimate'));
 const table=make('table'),head=make('thead'),tr=make('tr');
 for(const title of ['Description','Qty','Unit price','Line total'])tr.append(make('th','',title));
 head.append(tr);table.append(head);const body=make('tbody');
 for(const item of quote.items){const row=make('tr');
  for(const value of [item.description,Number(item.quantity).toString(),usd.format(Number(item.unitPrice)),usd.format(core.round(Number(item.quantity)*Number(item.unitPrice)))])row.append(make('td','',value));
  body.append(row)
 }
 table.append(body);area.append(table);
 const c=calculate(quote);
 line('Subtotal',usd.format(c.subtotal));if(c.discount)line('Discount',usd.format(-c.discount));
 line('Estimated sales tax',usd.format(c.tax));line('ESTIMATE TOTAL',usd.format(c.total));
 if(c.deposit)line('Deposit requested (not collected)',usd.format(c.deposit));
 if(quote.quoteNotes){area.append(make('h2','','Scope and diagnostic findings'),make('p','',quote.quoteNotes))}
 if(quote.quoteTerms){area.append(make('h2','','Terms'),make('p','',quote.quoteTerms))}
 area.append(make('p','print-warning','Estimate only. No payment or electronic approval was collected through Ravrent Mechanic. Further work, price changes, parts availability, warranties, labor taxes and safety-critical repairs require confirmation with the shop. This printout excludes internal costs and margins.'));
 area.hidden=false;$('quoteDialog').close();
 try{window.print()}catch{notify('Print is not available here. Use the browser Print or Save as PDF feature.')}
}
$('createQuote').addEventListener('click',()=>open());
$('closeQuote').addEventListener('click',()=>$('quoteDialog').close());
$('addLine').addEventListener('click',()=>{if(linesUI().length>=40){$('quoteFeedback').textContent='Maximum 40 items per quote.';return}addItem({kind:'part',quantity:1});renumber()});
$('quoteForm').addEventListener('submit',event=>{event.preventDefault();persistForm()});
$('quoteForm').addEventListener('input',totals);
$('quoteForm').addEventListener('change',totals);
$('quoteVin').addEventListener('input',()=>{$('quoteVin').value=$('quoteVin').value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,'').slice(0,17)});
$('deleteQuote').addEventListener('click',()=>{
 const quote=records.find(x=>x.id===editing);if(!quote)return;
 if(!confirm('Remove estimate '+quote.number+' from this device permanently?'))return;
 const previous=records;records=records.filter(x=>x.id!==editing);
 if(!saveStorage()){records=previous;$('quoteFeedback').textContent='Unable to delete from browser storage.';return}
 $('quoteDialog').close();editing=null;render();notify('Estimate deleted.')
});
$('duplicateQuote').addEventListener('click',()=>{
 const quote=records.find(x=>x.id===editing);if(!quote)return;
 open({...quote,id:null,number:'',quoteStage:'draft',created:'',updated:''});
 $('quoteFeedback').textContent='New unsaved copy. Save to create a separate draft.'
});
$('printQuote').addEventListener('click',()=>{const record=records.find(x=>x.id===editing);if(record)printEstimate(record)});
$('quoteSearch').addEventListener('input',render);
document.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>{
 filter=button.dataset.stage;
 document.querySelectorAll('[data-stage]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));
 render()
}));
$('exportQuotes').addEventListener('click',exportCsv);
$('backupQuotes').addEventListener('click',backup);
$('restoreQuotesButton').addEventListener('click',()=>$('restoreQuotes').click());
$('restoreQuotes').addEventListener('change',async event=>{const file=event.target.files?.[0];event.target.value='';await restore(file)});
window.addEventListener('afterprint',()=>{$('workshopPrint').hidden=true});
load();render();
})();