const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const google=require('../lib/google-error');
const groq=require('../lib/groq-provider');
const chatSource=fs.readFileSync(path.join(__dirname,'..','api/chat.js'),'utf8');
const checkSource=fs.readFileSync(path.join(__dirname,'..','api/provider-check.js'),'utf8');
const status=require('../api/status');
const res=()=>({code:200,data:null,setHeader(){},status(n){this.code=n;return this},json(v){this.data=v;return this}});
const Abort=class{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}};
function route(source,env,fetcher){
 const module={exports:{}};
 return new Function('require','module','process','fetch','AbortController','setTimeout','clearTimeout','URL','console',source+';return module.exports')(
   name=>name==='../lib/google-error'?google:name==='../lib/groq-provider'?groq:require(name),
   module,{env},fetcher,Abort,()=>1,()=>{},URL,{warn(){},error(){}});
}
function request(ip){return{method:'POST',headers:{origin:'https://ravrent-mechanic.vercel.app',host:'ravrent-mechanic.vercel.app','x-forwarded-for':ip},body:{messages:[{role:'user',text:'Explain a cold-start engine rattle and next checks'}],deep:false,research:false}}}
test('Groq is automatically selected over broken Gemini when Groq key is present',async()=>{
 const calls=[];
 const handler=route(chatSource,{GROQ_API_KEY:' test-groq ',GEMINI_API_KEY:'broken-gemini'},async(url,opts)=>{
  calls.push({url,opts});
  return{ok:true,json:async()=>({choices:[{message:{content:'Check oil level and document the cold-start noise.'}}]})};
 });
 const output=res();await handler(request('198.51.100.90'),output);
 assert.equal(output.code,200);
 assert.match(output.data.reply,/oil level/);
 assert.equal(output.data.provider,'Groq');
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/api.groq.com\/openai\/v1\/chat\/completions/);
 assert.equal(calls[0].opts.headers.Authorization,'Bearer test-groq');
 assert.ok(!JSON.stringify(output.data).includes('test-groq'));
});
test('Explicit Gemini selection still works when owner prefers it',async()=>{
 const calls=[];
 const handler=route(chatSource,{AI_PROVIDER:'gemini',GROQ_API_KEY:'test-groq',GEMINI_API_KEY:'test-google'},async(url,opts)=>{
  calls.push(url);
  return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Gemini test answer'}]}}]})};
 });
 const output=res();await handler(request('198.51.100.91'),output);
 assert.equal(output.code,200);assert.equal(output.data.reply,'Gemini test answer');
 assert.equal(calls.length,1);assert.match(calls[0],/generativelanguage.googleapis.com/);
});
test('Groq provider diagnostic tests model listing not Google API',async()=>{
 const calls=[];
 const handler=route(checkSource,{GROQ_API_KEY:'test-groq',GEMINI_API_KEY:'old-google'},async url=>{
  calls.push(url);return{ok:true,json:async()=>({data:[{id:'llama-3.3-70b-versatile'},{id:'qwen/qwen3.8-27b'}]})};
 });
 const output=res();await handler({method:'GET',headers:{'x-forwarded-for':'198.51.100.92'},query:{}},output);
 assert.equal(output.code,200);
 assert.equal(output.data.provider,'Groq');
 assert.equal(output.data.status,'provider_access_ok');
 assert.equal(output.data.standardModelListed,true);
 assert.equal(calls.length,1);assert.match(calls[0],/api.groq.com/);
});
test('Provider status never equates a key being installed with a live successful reply',()=>{
 const old=process.env.GROQ_API_KEY;const oldGemini=process.env.GEMINI_API_KEY;
 try{
  process.env.GROQ_API_KEY='placeholder';process.env.GEMINI_API_KEY='placeholder-google';
  const output=res();status({method:'GET'},output);
  assert.equal(output.data.provider,'Groq');
  assert.equal(output.data.configured,true);
  assert.equal(Object.hasOwn(output.data,'verified'),false);
 }finally{
  if(old===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=old;
  if(oldGemini===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldGemini;
 }
});
