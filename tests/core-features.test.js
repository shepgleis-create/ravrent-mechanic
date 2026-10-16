const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const health=require('../api/health');
const vin=require('../api/vin');
const ads=require('../api/ads-config');
const video=require('../lib/video');

function res(){
 return {code:200,headers:{},data:null,setHeader(k,v){this.headers[k]=v;},
 status(n){this.code=n;return this},json(x){this.data=x;return this}};
}
function stubResponse(ok,body,status=200){
 return {ok,status,json:async()=>body};
}
test('health is truthful: installed credentials are not verified',()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-not-a-real-key';
 try{const r=res();health({method:'GET'},r);
 assert.equal(r.code,200);assert.equal(r.data.assistant,'configured_unverified');
 assert.equal(r.data.providerTested,false);assert.doesNotMatch(JSON.stringify(r.data),/test-not-a-real-key/);
 }finally{if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test('ads stay disabled without explicit publisher approval and toggle',()=>{
 const keys=['ADSENSE_PUBLISHER_ID','ADSENSE_ENABLED','ADSENSE_APPROVED','ADSENSE_CONSENT_READY','ADSENSE_GUIDE_SLOT'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  process.env.ADSENSE_PUBLISHER_ID='ca-pub-1234567890123456';delete process.env.ADSENSE_ENABLED;
  let r=res();ads({method:'GET'},r);assert.equal(r.data.enabled,false);
  process.env.ADSENSE_ENABLED='true';r=res();ads({method:'GET'},r);
  assert.equal(r.data.enabled,false,'Ads must remain off without consent, approval and slot');
  process.env.ADSENSE_APPROVED='true';process.env.ADSENSE_CONSENT_READY='true';process.env.ADSENSE_GUIDE_SLOT='1234567890';
  r=res();ads({method:'GET'},r);
  assert.equal(r.data.enabled,true);assert.equal(r.data.publisherId,'ca-pub-1234567890123456');
  process.env.ADSENSE_PUBLISHER_ID='incorrect';r=res();ads({method:'GET'},r);
  assert.equal(r.data.enabled,false);
 }finally{for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k]}}
});
test('VIN decoder rejects malformed identifiers before calling external service',async()=>{
 const r=res();await vin({method:'GET',query:{vin:'SHORT'},headers:{'x-forwarded-for':'test-invalid'}},r);
 assert.equal(r.code,400);
});
test('VIN decoder populates known fields without inventing recall status',async()=>{
 const old=global.fetch;
 global.fetch=async()=>stubResponse(true,{Results:[{ModelYear:'2009',Make:'LEXUS',Model:'IS 250',DisplacementL:'2.5',EngineCylinders:'6',Trim:'Sedan'}]});
 try{
  const r=res();await vin({method:'GET',query:{vin:'JTHBK262295123456'},headers:{'x-forwarded-for':'test-vin'}},r);
  assert.equal(r.code,200);assert.equal(r.data.year,2009);assert.equal(r.data.model,'IS 250');
  assert.ok(!('recalls' in r.data));
 }finally{global.fetch=old;}
});
test('video body reader handles buffers, arraybuffers and serialized buffers',async()=>{
 const bytes=Buffer.from([0,1,2,3,255]);
 assert.deepEqual(await video.readBytes({body:bytes}),bytes);
 assert.deepEqual(await video.readBytes({body:Uint8Array.from(bytes)}),bytes);
 assert.deepEqual(await video.readBytes({body:Uint8Array.from(bytes).buffer}),bytes);
 assert.deepEqual(await video.readBytes({body:{type:'Buffer',data:[0,1,2,3,255]}}),bytes);
});
test('public guides exist while chat never includes ad loader',()=>{
 const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const guides=fs.readFileSync(path.join(__dirname,'../guides.html'),'utf8');
 assert.doesNotMatch(index,/adsbygoogle|src="\/ads.js"/);
 assert.match(guides,/src="\/ads.js"/);assert.match(guides,/id="charging"/);
 assert.match(index,/id="wizardPane"/);assert.match(index,/id="healthPane"/);
});
test('frontend and diagnostic wizard syntax is valid',()=>{
 for(const name of ['app.js','diagnostic-tools.js']){
  const source=fs.readFileSync(path.join(__dirname,'..',name),'utf8');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:name}));
 }
});
