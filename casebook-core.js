(function(root){'use strict';
const DTC=/\b[PCBU][0-3][0-9A-F]{3}\b/g;
const STATUSES=['open','testing','awaiting','resolved'];
const RESULTS=['planned','pass','fail','unclear'];
const clamp=(v,max=250)=>String(v==null?'':v).trim().slice(0,max);
function parseCodes(input){
 const normalized=String(input||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ');
 const found=normalized.match(DTC)||[];
 return [...new Set(found)].slice(0,30);
}
function triage(flags={}){
 const high=Boolean(flags.brakes||flags.steering||flags.fuelLeak||flags.overheat||flags.flashingCel||flags.smoke);
 return {high,level:high?'Stop and assess safety':'Needs diagnosis',
  reason:high?'A reported safety warning may make driving unsafe. Stop in a safe place and seek qualified assistance; this is not a diagnosis.':
   'No urgent warning was selected. This does not prove the vehicle is safe to drive.'};
}
function totals(amounts={}){
 const entries=['diagnostic','parts','labor','other'];
 let total=0;const breakdown={};
 for(const key of entries){
  const input=amounts[key]??0;
  const n=input===''?0:Number(input);
  if(!Number.isFinite(n)||n<0||n>10000000)throw Error('Enter nonnegative estimated expenses below $10 million.');
  breakdown[key]=Math.round((n+Number.EPSILON)*100)/100;
  total+=breakdown[key]
 }
 return {...breakdown,total:Math.round((total+Number.EPSILON)*100)/100};
}
function normalizeCase(data,{requireTitle=true}={}){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('A diagnostic case must be an object.');
 const name=clamp(data.name,110),vehicle=clamp(data.vehicle,160),vin=clamp(data.vin,17).toUpperCase();
 if(requireTitle&&!name)throw Error('Enter a short issue title.');
 if(!vehicle)throw Error('Enter the vehicle being investigated.');
 if(vin&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw Error('VIN must contain 17 valid characters or remain blank.');
 const miles=clamp(data.miles,9);
 if(miles&&(!/^\d+$/.test(miles)||Number(miles)>9999999))throw Error('Mileage must be a whole number.');
 const flags={};for(const key of ['brakes','steering','fuelLeak','overheat','flashingCel','smoke'])flags[key]=data.flags?.[key]===true;
 const tests=(Array.isArray(data.tests)?data.tests:[]).slice(0,25).map(item=>{
  const title=clamp(item?.name,140),outcome=clamp(item?.result,12),note=clamp(item?.note,400);
  if(!title)return null;
  return {name:title,result:RESULTS.includes(outcome)?outcome:'planned',note};
 }).filter(Boolean);
 const amounts=totals(data.amounts);
 return {
  name,vehicle,vin,miles,status:STATUSES.includes(data.status)?data.status:'open',
  symptoms:clamp(data.symptoms,2800),conditions:clamp(data.conditions,1300),codes:parseCodes(data.codes||''),
  flags,tests,amounts,summary:clamp(data.summary,2400),
  id:clamp(data.id,100),created:clamp(data.created,40),updated:clamp(data.updated,40)
 };
}
// Safe, unperformed starting points. These are checklists, not claimed test results.
const TEST_TEMPLATES=Object.freeze({
 noStart:{name:'No-start and charging',items:[
  'Record resting battery voltage with a suitable meter',
  'Record cranking voltage and starter behavior',
  'Check battery terminals, grounds and charging-system supply',
  'Scan stored and pending codes without clearing evidence']},
 misfire:{name:'Misfire or rough running',items:[
  'Record all codes, freeze-frame and misfire conditions',
  'Review cylinder misfire counts, if supported by scanner',
  'Check fuel trims and intake leak evidence',
  'Verify ignition, fuel and mechanical evidence before replacing parts']},
 overheating:{name:'Overheating concern',items:[
  'Stop safely and let engine cool; never open a hot pressurized cap',
  'Record temperature warnings and coolant-loss evidence after cooling',
  'Inspect for external leaks and visible hose condition when safe',
  'Arrange qualified cooling-system pressure/fan testing']},
 prePurchase:{name:'Pre-purchase inspection',items:[
  'Inspect tires, brakes, steering and suspension for obvious concerns',
  'Record codes and emissions readiness without erasing them',
  'Verify VIN and ownership/title evidence through authorized sources',
  'Document test-drive behavior only when safe and lawful']},
 electrical:{name:'Intermittent electrical problem',items:[
  'Record voltage before, during and after the reported failure',
  'Inspect visible connectors, fuses and battery grounds safely',
  'Identify affected circuits and record exact DTCs',
  'Compare findings with vehicle-specific wiring diagrams']},
 noise:{name:'Cold-start engine noise',items:[
  'Record duration, conditions, oil level and maintenance history',
  'Check actual vehicle oil specification and filter information',
  'Measure pressure or other mechanical data only with qualified tools',
  'Review timing-system and accessory symptoms without assuming a failed part']}
});
function templateTests(id){
 const entry=TEST_TEMPLATES[String(id||'')];
 return entry?entry.items.map(name=>({name,result:'planned',note:''})):[];
}
function exportReview(c){
 const parts=[
  'Help organize the next safe diagnostic steps for a reported vehicle problem. Do not invent test results or recommend replacing a part without evidence.',
  'Vehicle: '+c.vehicle+(c.miles?' / '+c.miles+' miles':'')+(c.vin?' / VIN '+c.vin:'')+'.',
  'Reported issue: '+c.name+'.',
  c.symptoms?'Reported symptoms: '+c.symptoms.slice(0,900)+'.':'',
  c.conditions?'Conditions: '+c.conditions.slice(0,450)+'.':'',
  c.codes.length?'Stored codes reported: '+c.codes.join(', ')+'. Codes do not prove failed components.':'',
  triage(c.flags).high?'Urgent reported hazard flags were selected; address safety before further driving.':'',
  ...c.tests.slice(0,8).map(t=>'User-entered test '+t.name+' — '+t.result+(t.note?' ('+t.note.slice(0,130)+')':'')),
  'Provide 2-3 plausible hypotheses, the least invasive next tests, when a technician is needed, and uncertainties.'
 ];
 return parts.filter(Boolean).join('\n').slice(0,3700);
}
const api={parseCodes,triage,totals,normalizeCase,exportReview,TEST_TEMPLATES,templateTests};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.RavrentCasebookCore=api;
})(typeof window!=='undefined'?window:null);
