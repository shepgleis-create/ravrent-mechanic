const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../fleet-core');
const workshop=require('../workshop-core');
const garage={vehicles:[
 {id:'car-a',year:2009,make:'LEXUS',model:'IS 250',vin:'JTHBK262295123456',miles:155600},
 {id:'car-b',year:2005,make:'INFINITI',model:'G35',vin:'',miles:186500}
]};
const plan={id:'plan-a',name:'Owner scheduled oil inspection',vehicleId:'car-a',dueMileage:156000,intervalMiles:5000};
const scenario=()=>({
 garage,
 schedule:{version:1,plans:[plan],readings:{'car-a':156100}},
 repairCases:[{vehicleId:'car-b',title:'Brake concern',priority:'urgent',status:'open'},{vehicleId:'missing-car',title:'Unassigned',status:'open'}],
 casebook:[
  {vin:'JTHBK262295123456',name:'Cold-start rattle',status:'testing',codes:['P0010'],flags:{brakes:true}},
  {vin:'',name:'Unknown vehicle',status:'open'},
  {vin:'1HGCM82633A004352',name:'Another car',status:'open'}
 ],
 workshop:[
  {quoteVin:'JTHBK262295123456',quoteStage:'quoted',quoteDiscount:'10',quoteTax:'8.25',items:[
   {kind:'labor',quantity:'2',unitPrice:'100',internalCost:'40',taxable:false},
   {kind:'part',quantity:'1',unitPrice:'100',internalCost:'45',taxable:true}
  ]},
  {quoteVin:'',quoteStage:'quoted',items:[{kind:'labor',quantity:1,unitPrice:200,internalCost:70,taxable:false}]}
 ],
 inventory:[{vin:'JTHBK262295123456',stage:'purchased'},{vin:'',stage:'lead'}],
 annotations:{'car-b':{state:'hold',owner:'Team A',notes:'Brake inspection pending'}}
});
test('fleet joins only exact VIN or garage vehicle IDs and never guesses based on model',()=>{
 const data=scenario(),result=core.build(data,'2026-10-15');
 assert.equal(result.totals.vehicles,2);
 assert.equal(result.vehicles[0].urgent,true);
 assert.equal(result.vehicles[1].urgent,true);
 const lexus=result.vehicles.find(v=>v.id==='car-a'),infiniti=result.vehicles.find(v=>v.id==='car-b');
 assert.equal(lexus.due,1);
 assert.equal(lexus.caseCount,1);
 assert.equal(lexus.inventoryCount,1);
 assert.equal(lexus.quoteCount,1);
 assert.equal(infiniti.caseCount,0,'Casebook without VIN must not be linked to G35 by name');
 assert.equal(infiniti.repairCount,1);
 assert.equal(infiniti.state,'hold');
 assert.equal(result.missing.casebook,2);
 assert.equal(result.missing.workshop,1);
 assert.equal(result.missing.inventory,1);
 assert.equal(result.missing.repairCases,1);
});
test('linked quote values use existing item discount and tax math, not invented payments',()=>{
 const data=scenario(),expected=workshop.calculate({items:data.workshop[0].items,discount:10,taxRate:8.25}).total;
 const result=core.build(data,'2026-10-15');
 assert.equal(result.totals.quotedNotCollected,expected);
 assert.equal(result.vehicles.find(v=>v.id==='car-a').quoteValue,expected);
 data.workshop[0].quoteStage='completed';
 assert.equal(core.build(data,'2026-10-15').totals.quotedNotCollected,0,'Completed work is not open quoted pipeline');
});
test('maintenance due status uses entered mileage rather than VIN-implied manufacturer intervals',()=>{
 const data=scenario();data.schedule.readings['car-a']=155000;
 assert.equal(core.build(data,'2026-10-15').vehicles.find(v=>v.id==='car-a').soon,0);
 data.schedule.readings['car-a']=155750;
 assert.equal(core.build(data,'2026-10-15').vehicles.find(v=>v.id==='car-a').soon,1);
 data.schedule.readings['car-a']=156050;
 assert.equal(core.build(data,'2026-10-15').vehicles.find(v=>v.id==='car-a').due,1);
});
test('annotations filter invalid keys and bound optional data without mutating Garage',()=>{
 const before=JSON.stringify(garage);
 const state=core.sanitizeAnnotations({'car-b':{state:'out_of_service',notes:'X'.repeat(1200),owner:'Y'.repeat(170)},'__proto__':{state:'hold'}});
 assert.equal(state['car-b'].notes.length,700);
 assert.equal(state['car-b'].owner.length,70);
 assert.equal(core.build({...scenario(),annotations:state},'2026-10-15').vehicles.find(v=>v.id==='car-b').state,'out_of_service');
 assert.equal(JSON.stringify(garage),before);
});
test('fleet annotations cannot mutate Object.prototype and missing mileage is not a recorded zero',()=>{
 const attack=JSON.parse('{"__proto__":{"state":"hold","notes":"tamper"},"car-b":{"state":"active"}}');
 const sanitized=core.sanitizeAnnotations(attack);
 assert.equal(Object.getPrototypeOf(sanitized),null);
 assert.equal(({}).state,undefined);
 const emptyMileage=core.build({garage:{vehicles:[{id:'unused',year:2004,make:'FORD',model:'FOCUS',miles:0}]}},'2026-10-15');
 assert.equal(emptyMileage.vehicles[0].miles,null);
});
test('fleet AI handoff selects the correct car in a fresh chat without auto-sending',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','fleet.js'),'utf8');
 const chat=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.match(ui,/source:'fleet',vehicleId:vehicle\.id/);
 assert.match(chat,/data\.activeVehicleId=entry\.vehicleId/);
 assert.match(chat,/data\.currentId=null;ensureThread\(\);store\(\)/);
 assert.match(chat,/no request was made automatically/i);
 assert.match(ui,/Linked quote records/);
});
test('fleet page and all connected handoff controls exist and are parsable',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','fleet.html'),'utf8');
 const script=fs.readFileSync(path.join(__dirname,'..','fleet.js'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const planner=fs.readFileSync(path.join(__dirname,'..','maintenance-planner.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(script));
 for(const id of ['fleetVehicles','fleetSearch','fleetStatus','fleetDue','fleetUrgent','fleetQuotes','unlinkedBreakdown','fleetExport','fleetRefresh'])
  assert.ok(html.includes('id="'+id+'"'),id+' missing');
 for(const key of ['ravrent-mechanic-v2','ravrent_service_schedule_v1','ravrent_diagnostic_casebook_v1','ravrent_workshop_estimates_v1','ravrent_reseller_inventory_v1'])
  assert.ok(script.includes(key),'missing '+key);
 assert.match(app,/\['vin','workshop','health','casebook','fleet'\]/);
 assert.match(planner,/URLSearchParams\(location\.search\)/);
 assert.match(html,/src="\/fleet-core\.js"/);
 assert.doesNotMatch(html,/<a[^>]+href="https?:/i);
});
