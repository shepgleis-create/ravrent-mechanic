const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const decode=require('../api/vin');
const recall=require('../api/recalls');
const complaints=require('../api/complaints');
const safety=require('../api/safety');
function reply(){return {statusCode:200,body:null,setHeader(){},status(code){this.statusCode=code;return this},json(payload){this.body=payload;return this}}}
async function request(handler,query,ip='198.51.100.11'){const res=reply();await handler({method:'GET',query,headers:{'x-forwarded-for':ip}},res);return res}
async function withFetch(mock,cb){const old=global.fetch;global.fetch=mock;try{await cb()}finally{global.fetch=old}}
const vehicle={year:'2009',make:'LEXUS',model:'IS 250'};
test('VIN decoder returns only NHTSA configuration fields',async()=>{
 await withFetch(async url=>{assert.match(url,/vpic.nhtsa.dot.gov/);return {ok:true,json:async()=>({Results:[{Make:'LEXUS',Model:'IS 250',ModelYear:'2009',Trim:'250',DisplacementL:'2.5',EngineCylinders:'6'}]})}},async()=>{
  const result=await request(decode,{vin:'1HGCM82633A004352'});
  assert.equal(result.statusCode,200);assert.equal(result.body.year,2009);
  assert.equal(result.body.make,'LEXUS');assert.equal(result.body.titleHistory,undefined);
 });
 const invalid=await request(decode,{vin:'BAD'});
 assert.equal(invalid.statusCode,400);
});
test('recall API identifies model-level campaigns, not an open VIN recall',async()=>{
 await withFetch(async url=>{assert.match(url,/recallsByVehicle/);assert.match(url,/modelYear=2009/);return {ok:true,json:async()=>({results:[{NHTSACampaignNumber:'09V388000',Component:'PEDAL',Summary:'Test sample'}]})}},async()=>{
  const result=await request(recall,vehicle);assert.equal(result.statusCode,200);
  assert.equal(result.body.count,1);assert.equal(result.body.recalls[0].campaign,'09V388000');
  assert.match(result.body.scope,/not VIN-specific/i);assert.equal(result.body.vinStatus,undefined)
 });
 assert.equal((await request(recall,{year:2009,make:'!',model:''})).statusCode,400)
});
test('complaints API labels consumer reports as unverified model data',async()=>{
 await withFetch(async url=>{assert.match(url,/complaintsByVehicle/);return {ok:true,json:async()=>({Count:1,results:[{odiNumber:'123',components:['ENGINE'],summary:'Test consumer report'}]})}},async()=>{
  const result=await request(complaints,vehicle);
  assert.equal(result.statusCode,200);assert.equal(result.body.count,1);
  assert.equal(result.body.complaints[0].id,'123');assert.match(result.body.scope,/not this VIN/i)
 });
});
test('safety API lists tested variants and returns their ratings only on selection',async()=>{
 await withFetch(async url=>{
  if(url.includes('VehicleId'))return {ok:true,json:async()=>({Results:[{OverallRating:'4',OverallFrontCrashRating:'3',OverallSideCrashRating:'5',RolloverRating:'4'}]})};
  assert.match(url,/SafetyRatings\/modelyear\/2009/);
  return {ok:true,json:async()=>({Results:[{VehicleId:101,VehicleDescription:'Test RWD sedan'}]})}
 },async()=>{
  const variants=await request(safety,vehicle);assert.equal(variants.statusCode,200);assert.equal(variants.body.variants[0].id,101);
  const rating=await request(safety,{vehicleId:'101'});assert.equal(rating.statusCode,200);assert.equal(rating.body.overall,'4')
 });
 assert.equal((await request(safety,{vehicleId:'../../secrets'})).statusCode,400)
});
test('browser VIN scripts parse and camera controls exist',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','vin-report.html'),'utf8');
 const scanner=fs.readFileSync(path.join(__dirname,'..','vin-scanner.js'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'..','vin-report.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(scanner));assert.doesNotThrow(()=>new vm.Script(app));
 for(const id of ['scanVin','vinPhoto','captureVin','vinVideo','stopScan','decode','safetyVariant','complaintStatus','recallStatus']){
  assert.ok(html.includes('id="'+id+'"'),'missing '+id)
 }
 assert.ok(!html.includes('href="https://www.nhtsa.gov/recalls"'),'must not redirect out of app')
});
