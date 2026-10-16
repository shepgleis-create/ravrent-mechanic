(function(root){'use strict';
const maintenance=typeof module!=='undefined'&&module.exports?require('./maintenance-core'):root?.RavrentSchedule;
if(!maintenance)throw Error('Vehicle maintenance calculations are not loaded');
const quoteMath=typeof module!=='undefined'&&module.exports?require('./workshop-core'):root?.RavrentWorkshopCore;
if(!quoteMath)throw Error('Workshop pricing calculations are not loaded');
const VIN=/^[A-HJ-NPR-Z0-9]{17}$/;
const FLAGS=['brakes','steering','fuelLeak','overheat','flashingCel','smoke'];
const STATES=['active','inspection','hold','out_of_service'];
const trunc=(v,n=140)=>String(v??'').trim().slice(0,n);
const validVin=v=>VIN.test(trunc(v,17).toUpperCase())?trunc(v,17).toUpperCase():'';
const money=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=1e9?n:0};
const isArray=x=>Array.isArray(x)?x:[];
function vehicleName(v){return [v.year,v.make,v.model,v.trim].map(x=>trunc(x,80)).filter(Boolean).join(' ')||'Unknown garage vehicle'}
function sanitizeAnnotations(obj){
 const out=Object.create(null);
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return out;
 for(const [key,value] of Object.entries(obj).slice(0,300)){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key)||!value||typeof value!=='object')continue;
  const state=STATES.includes(value.state)?value.state:'active',notes=trunc(value.notes,700),owner=trunc(value.owner,70);
  out[key]={state,notes,owner};
 }
 return out
}
function build({garage={},schedule={},repairCases=[],casebook=[],workshop=[],inventory=[],annotations={}},today=new Date().toISOString().slice(0,10)){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(today))throw Error('Expected a date');
 const cars=isArray(garage.vehicles).filter(x=>x&&typeof x==='object'&&x.id).slice(0,300);
 const garageIds=new Set(cars.map(x=>String(x.id)));
 const vins=new Set(cars.map(x=>validVin(x.vin)).filter(Boolean));
 const missing={repairCases:0,casebook:0,workshop:0,inventory:0,schedule:0};
 const repair=isArray(repairCases).filter(c=>c&&typeof c==='object');
 const diagnosed=isArray(casebook).filter(c=>c&&typeof c==='object');
 const quotes=isArray(workshop).filter(c=>c&&typeof c==='object');
 const stock=isArray(inventory).filter(c=>c&&typeof c==='object');
 const plans=isArray(schedule.plans).filter(c=>c&&typeof c==='object');
 const meta=sanitizeAnnotations(annotations);
 for(const c of repair)if(!garageIds.has(String(c.vehicleId||'')))missing.repairCases++;
 for(const c of diagnosed)if(!validVin(c.vin)||!vins.has(validVin(c.vin)))missing.casebook++;
 for(const c of quotes)if(!validVin(c.quoteVin)||!vins.has(validVin(c.quoteVin)))missing.workshop++;
 for(const c of stock)if(!validVin(c.vin)||!vins.has(validVin(c.vin)))missing.inventory++;
 for(const c of plans)if(!garageIds.has(String(c.vehicleId||'')))missing.schedule++;
 const out=cars.map(v=>{
  const id=String(v.id),vin=validVin(v.vin),details=meta[id]||{state:'active',notes:'',owner:''};
  const scheduled=plans.filter(p=>String(p.vehicleId||'')===id).map(p=>{
   try{
    const clean=maintenance.makePlan(p);
    const override=Object.hasOwn(schedule.readings||{},id)?schedule.readings[id]:v.miles;
    const current=override!==''&&override!==null&&Number.isFinite(Number(override))?Number(override):null;
    return {...clean,computed:maintenance.dueStatus(clean,current,today)};
   }catch{return null}
  }).filter(Boolean);
  const openRepairs=repair.filter(c=>String(c.vehicleId||'')===id&&c.status!=='resolved');
  const openCases=vin?diagnosed.filter(c=>validVin(c.vin)===vin&&c.status!=='resolved'):[];
  const linkedQuotes=vin?quotes.filter(c=>validVin(c.quoteVin)===vin):[];
  const linkedInventory=vin?stock.filter(c=>validVin(c.vin)===vin):[];
  const urgent=openRepairs.some(c=>c.priority==='urgent')||openCases.some(c=>FLAGS.some(flag=>c.flags?.[flag]===true));
  const due=scheduled.filter(p=>p.computed.status==='due').length;
  const soon=scheduled.filter(p=>p.computed.status==='soon').length;
  const flagged=details.state==='hold'||details.state==='out_of_service';
  const rank=urgent?0:flagged?1:due?2:soon?3:(openRepairs.length||openCases.length)?4:5;
  let quoteValue=0;
  for(const q of linkedQuotes){
   if(!['quoted','approved','progress'].includes(q.quoteStage))continue;
   try{
    const total=quoteMath.calculate({items:q.items,discount:q.quoteDiscount,taxRate:q.quoteTax,depositPercent:q.quoteDeposit}).total;
    if(Number.isFinite(total)&&total>=0&&total<1e8)quoteValue+=total;
   }catch{}
  }
  const lastObserved=Object.hasOwn(schedule.readings||{},id)?schedule.readings[id]:v.miles;
  const miles=lastObserved!==null&&lastObserved!==''&&Number.isFinite(Number(lastObserved))&&Number(lastObserved)>0?Math.round(Number(lastObserved)):null;
  return {id,name:vehicleName(v),vin,engine:trunc(v.engine,100),miles,
   state:details.state,notes:details.notes,owner:details.owner,urgent,due,soon,rank,
   repairCount:openRepairs.length,caseCount:openCases.length,quoteCount:linkedQuotes.length,
   quoteValue:Math.round(quoteValue*100)/100,inventoryCount:linkedInventory.length,plans:scheduled,
   openRepairs:openRepairs.map(c=>({title:trunc(c.title,120),priority:c.priority,status:c.status})).slice(0,20),
   openCases:openCases.map(c=>({title:trunc(c.name,120),status:c.status,codes:isArray(c.codes).slice(0,8)})).slice(0,20),
   stage:linkedInventory[0]?.stage||null
  };
 }).sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name));
 return {vehicles:out,missing,totals:{
  vehicles:out.length,urgent:out.filter(v=>v.urgent).length,
  attention:out.filter(v=>v.urgent||v.state==='hold'||v.state==='out_of_service'||v.due>0).length,
  due:out.reduce((n,v)=>n+v.due,0),soon:out.reduce((n,v)=>n+v.soon,0),
  openCases:out.reduce((n,v)=>n+v.caseCount+v.repairCount,0),
  quotedNotCollected:Math.round(out.reduce((n,v)=>n+v.quoteValue,0)*100)/100,
  unlinked:Object.values(missing).reduce((a,b)=>a+b,0)
 }};
}
const api={build,vehicleName,sanitizeAnnotations,validVin,STATES};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.RavrentFleetCore=api;
})(typeof window!=='undefined'?window:null);
