(function(root){'use strict';
const workshop=typeof module!=='undefined'&&module.exports?require('./workshop-core'):root?.RavrentWorkshopCore;
if(!workshop)throw Error('Estimate math unavailable');
const {calculate,round}=workshop;
const stages=['draft','quoted','approved','progress','completed'];
function estimate(records,days=0,now=Date.now()){
 const list=(Array.isArray(records)?records:[]).filter(record=>record&&stages.includes(record.quoteStage));
 const cutoff=Number(days)>0?now-Number(days)*86400000:null;
 const filtered=list.filter(r=>{
  if(cutoff===null)return true;
  const stamp=Date.parse(r.updated||r.created||'');
  return Number.isFinite(stamp)&&stamp>=cutoff&&stamp<=now
 });
 const groups=Object.fromEntries(stages.map(x=>[x,{stage:x,count:0,value:0}]));
 let issued=0,approved=0,openValue=0,completedValue=0,completedBeforeTax=0,completedInternal=0;
 const mix={labor:{sales:0,cost:0},part:{sales:0,cost:0},fee:{sales:0,cost:0}};
 let skipped=0;
 for(const record of filtered){
  let amounts;try{amounts=calculate({items:record.items,taxRate:record.quoteTax,discount:record.quoteDiscount,depositPercent:record.quoteDeposit})}catch{skipped++;continue}
  if(!Number.isFinite(amounts.total)||amounts.total>1e9){skipped++;continue}
  const stage=record.quoteStage;groups[stage].count++;groups[stage].value=round(groups[stage].value+amounts.total);
  if(stage!=='draft')issued++;
  if(['approved','progress','completed'].includes(stage))approved++;
  if(['quoted','approved','progress'].includes(stage))openValue=round(openValue+amounts.total);
  if(stage==='completed'){
   completedValue=round(completedValue+amounts.total);
   completedBeforeTax=round(completedBeforeTax+amounts.beforeTax);
   completedInternal=round(completedInternal+amounts.internalCost);
   const subtotal=amounts.subtotal||0,discount=amounts.discount||0;
   for(const item of record.items||[]){
    const kind=stages.includes(item.kind)?'fee':mix[item.kind]?item.kind:'fee';
    const qty=Number(item.quantity),unitPrice=Number(item.unitPrice),internalCost=Number(item.internalCost);
    if(!Number.isFinite(qty)||!Number.isFinite(unitPrice)||!Number.isFinite(internalCost))continue;
    const raw=round(qty*unitPrice),allocated=subtotal>0?round(raw*(1-discount/subtotal)):raw;
    mix[kind].sales=round(mix[kind].sales+allocated);
    mix[kind].cost=round(mix[kind].cost+round(qty*internalCost))
   }
  }
 }
 return {count:filtered.length-skipped,skipped,issued,approved,openValue,completedValue,approvalRate:issued?round(approved/issued*100):null,groups,completedBeforeTax,completedInternal,estimatedGrossMargin:round(completedBeforeTax-completedInternal),mix}
}
function requiredLaborRate(input){
 const keys=['overhead','targetProfit','billableHours','laborCostPerHour','partsGrossProfit'];
 const values={};
 for(const k of keys){const value=input?.[k];if(value===''||value===undefined||value===null){values[k]=0;continue}const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e8)throw Error('Enter valid nonnegative operating costs.');values[k]=n}
 const {overhead,targetProfit,billableHours,laborCostPerHour,partsGrossProfit}=values;
 if(!billableHours||billableHours>100000)throw Error('Enter expected monthly billable hours greater than zero.');
 if(laborCostPerHour>1e6)throw Error('Labor cost per hour is outside the supported range.');
 const totalNeeded=round(overhead+targetProfit),laborContribution=round(Math.max(0,totalNeeded-partsGrossProfit)),requiredPerHour=round(laborContribution/billableHours),rate=round(requiredPerHour+laborCostPerHour);
 return {totalNeeded,partsGrossProfit:round(partsGrossProfit),laborContribution,requiredPerHour,rate,billableHours,laborCostPerHour}
}
const api={estimate,requiredLaborRate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.RavrentShopInsights=api;
})(typeof window!=='undefined'?window:null);
