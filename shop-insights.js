(()=>{'use strict';
const $=id=>document.getElementById(id);
const core=window.RavrentShopInsights;
if(!core)return;
const SOURCE='ravrent_workshop_estimates_v1',PLANNING='ravrent_shop_planning_v1';
const stages=[['draft','Draft'],['quoted','Quoted'],['approved','Customer approved'],['progress','In progress'],['completed','Completed (not paid)']];
const fields=['monthlyOverhead','monthlyTarget','billableHours','laborCost','partsContribution'];
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const precise=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const span=(v)=>String(v??'');
let metrics=null;
function add(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el}
function read(){
 try{const list=JSON.parse(localStorage.getItem(SOURCE)||'[]');return Array.isArray(list)?list.filter(x=>x&&typeof x==='object').slice(0,200):[]}catch{return[]}
}
function renderPipeline(result){
 const root=$('pipelineRows');root.replaceChildren();
 for(const [key,name] of stages){
  const item=result.groups[key],row=add('div','pipeline-row');
  row.append(add('span','',name),add('strong','',item.count.toLocaleString()),add('b','',money.format(item.value)));
  root.append(row)
 }
}
function renderMargin(result){
 const host=$('marginLines');host.replaceChildren();
 for(const [type,name] of [['labor','Labor'],['part','Parts'],['fee','Shop fees']]){
  const data=result.mix[type];const line=add('div','margin-line'),label=add('span','',name);
  const cost=add('small','','Sales '+money.format(data.sales)+' · Direct cost '+money.format(data.cost));
  const amount=add('strong','',money.format(data.sales-data.cost));if(data.sales-data.cost<0)amount.className='negative';
  line.append(label,cost,amount);host.append(line)
 }
 const total=add('div','margin-line total-line');
 total.append(add('span','','Estimated contribution before overhead'),add('small','','Tax excluded'),add('strong','',money.format(result.estimatedGrossMargin)));
 host.append(total)
}
function refresh(){
 const count=Number($('period').value)||0;
 const dataset=read();
 const summary=core.estimate(dataset,count);
 metrics=summary;
 $('issuedCount').textContent=String(summary.issued);
 $('pipelineValue').textContent=money.format(summary.openValue);
 $('completedValue').textContent=money.format(summary.completedValue);
 $('approvalRate').textContent=summary.approvalRate===null?'—':summary.approvalRate.toFixed(1)+'%';
 $('dataStatus').textContent=dataset.length?
  'Based on '+summary.count+' saved estimates'+(summary.skipped?' ('+summary.skipped+' invalid records ignored)':'')+'. Customer payments are not verified.':
  'No saved workshop estimates on this browser yet.';
 renderPipeline(summary);renderMargin(summary)
}
function planner(){
 try{
  const values=fields.map(id=>$(id).value.trim()),[overhead,targetProfit,billableHours,laborCostPerHour,partsGrossProfit]=values;
  if(!billableHours||Number(billableHours)<=0){
   $('requiredRate').textContent='—';$('perHourContribution').textContent='—';$('requiredContribution').textContent='—';
   $('rateExplanation').textContent='Enter expected monthly billable hours to calculate a planning rate.';return
  }
  const outcome=core.requiredLaborRate({overhead,targetProfit,billableHours,laborCostPerHour,partsGrossProfit});
  $('requiredRate').textContent=precise.format(outcome.rate)+' / billed hour';
  $('perHourContribution').textContent=precise.format(outcome.requiredPerHour);
  $('requiredContribution').textContent=money.format(outcome.laborContribution);
  $('rateExplanation').textContent='At '+outcome.billableHours.toLocaleString('en-US')+' monthly billed hours, this rate targets the entered overhead and operating contribution using the expected parts margin. This is not a market-based quote.';
 }catch(e){
  $('requiredRate').textContent='—';$('perHourContribution').textContent='—';$('requiredContribution').textContent='—';
  $('rateExplanation').textContent=e.message||'Enter valid figures.'
 }
}
function saveAssumptions(){
 const payload={savedAt:new Date().toISOString()};
 for(const id of fields){const number=Number($(id).value);if(!Number.isFinite(number)||number<0||number>100000000){$('rateExplanation').textContent='Enter nonnegative figures before saving.';return}payload[id]=String($(id).value)}
 try{localStorage.setItem(PLANNING,JSON.stringify(payload));$('rateExplanation').textContent='Planning assumptions saved on this browser.'}
 catch{$('rateExplanation').textContent='Browser storage unavailable. Assumptions were not saved.'}
}
function restoreAssumptions(){
 try{const data=JSON.parse(localStorage.getItem(PLANNING)||'null');if(!data||typeof data!=='object')return;
  for(const id of fields){const value=String(data[id]??'');if(value===''||!Number.isFinite(Number(value))||Number(value)<0)continue;$(id).value=value}
 }catch{}
}
function csvCell(v){const value=span(v);return '"'+(/^[\s]*[=+@-]/.test(value)?"'"+value:value).replace(/"/g,'""')+'"'}
function exportSummary(){
 if(!metrics)return;
 const rows=[['Metric','Value'],['Reporting period',$('period').selectedOptions?.[0]?.textContent||$('period').value],
  ['Quotes issued',metrics.issued],['Open quoted value',metrics.openValue],['Completed work value (not payments)',metrics.completedValue],
  ['Recorded approval rate percent',metrics.approvalRate??'Not available'],
  ['Completed estimated pre-overhead gross margin',metrics.estimatedGrossMargin],
  ...stages.map(([s,name])=>[name+' count',metrics.groups[s].count])];
 const file='ravrent-shop-summary-'+new Date().toISOString().slice(0,10)+'.csv';
 const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('dataStatus').textContent='Summary exported without customer names or contact details.'
}
$('period').addEventListener('change',refresh);
for(const id of fields)$(id).addEventListener('input',planner);
$('saveAssumptions').addEventListener('click',saveAssumptions);
$('exportInsight').addEventListener('click',exportSummary);
restoreAssumptions();refresh();planner();
})();