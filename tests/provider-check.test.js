const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','api','provider-check.js'),'utf8');
const googleError=require('../lib/google-error');
const groqProvider=require('../lib/groq-provider');
const togetherProvider=require('../lib/together-provider');
const usageMeter=require('../lib/usage-meter');
const request=ip=>({method:'GET',headers:{'x-forwarded-for':ip},query:{}});
const result=()=>({code:200,body:null,setHeader(){},status(code){this.code=code;return this},json(value){this.body=value;return this}});
function build(key,fetcher){
 const context={module:{exports:{}},require:name=>name==='../lib/google-error'?googleError:name==='../lib/groq-provider'?groqProvider:name==='../lib/together-provider'?togetherProvider:{},process:{env:key?{GEMINI_API_KEY:'  '+key+'  '}:{}},fetch:fetcher,
  AbortController:class{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}},
  setTimeout:()=>1,clearTimeout:()=>{}};
 vm.runInNewContext(source,context);
 return context.module.exports
}
test('provider check does not pretend configured key means verified access',async()=>{
 const handler=build('',()=>{throw Error('Should not call Google without key')});
 const r=result();await handler(request('198.51.100.201'),r);
 assert.equal(r.body.status,'not_configured');assert.equal(r.body.code,'MISSING_KEY');
});
test('invalid Google AI key is diagnosed without leaking a credential',async()=>{
 let sentKey=null;
 const handler=build('not-a-real-key',async(url,opts)=>{
  sentKey=opts.headers['x-goog-api-key'];
  return {ok:false,status:403,json:async()=>({error:{message:'API key not valid. Please pass a valid API key.'}})}
 });
 const r=result();await handler(request('198.51.100.202'),r);
 assert.equal(sentKey,'not-a-real-key');
 assert.equal(r.body.code,'AI_KEY_INVALID');
 assert.equal(r.body.status,'failed');
 assert.ok(!JSON.stringify(r.body).includes('not-a-real-key'))
});
test('provider list access checks configured models, but does not claim live generation',async()=>{
 const handler=build('test-key',async()=>({ok:true,json:async()=>({models:[
  {name:'models/gemini-2.5-flash-lite',supportedGenerationMethods:['generateContent']},
  {name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}
 ]})}));
 const r=result();await handler(request('198.51.100.203'),r);
 assert.equal(r.code,200);assert.equal(r.body.code,'MODEL_LIST_PASSED');
 assert.equal(r.body.standardModelListed,true);assert.equal(r.body.deepModelListed,true);
 assert.match(r.body.note,/live generateContent response is still required/i);
});
