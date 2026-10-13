const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','api','chat.js'),'utf8');
const googleError=require('../lib/google-error');
const groqProvider=require('../lib/groq-provider');
const togetherProvider=require('../lib/together-provider');
const usageMeter=require('../lib/usage-meter');
function build(mode){
 const calls=[],mod={exports:{}};
 const mock=async (url,options)=>{
  calls.push({url,key:options.headers['x-goog-api-key']});
  const lite=url.includes('gemini-2.5-flash-lite');
  if(mode==='success'||(mode==='model-permission'&&lite))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Verified model response'}]}}]})};
  return {ok:false,status:403,json:async()=>({error:{message:mode==='invalid-key'?'API key not valid. Please pass a valid API key.':'Requested model does not exist or model access denied.'}})};
 };
 const handler=new Function('require','module','process','fetch','AbortController','setTimeout','clearTimeout','console','URL',source+';return module.exports')(
  name=>name==='../lib/google-error'?googleError:name==='../lib/groq-provider'?groqProvider:name==='../lib/together-provider'?togetherProvider:name==='../lib/usage-meter'?usageMeter:{},mod,{env:{GEMINI_API_KEY:' test-secret ',...(mode==='model-permission'?{GEMINI_STANDARD_MODEL:'gemini-2.5-flash'}:{})}},
  mock,class{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}},()=>1,()=>{},
  {warn(){},error(){}},URL);
 return {handler,calls}
}
const request=ip=>({method:'POST',headers:{origin:'https://ravrent-mechanic.vercel.app',host:'ravrent-mechanic.vercel.app','x-forwarded-for':ip},body:{messages:[{role:'user',text:'Test AI'}],deep:false,research:false}});
const response=()=>({statusCode:200,body:null,setHeader(){},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}});
test('invalid provider API key produces an actionable, sanitized code',async()=>{
 const {handler,calls}=build('invalid-key'),out=response();
 await handler(request('198.51.100.110'),out);
 assert.equal(out.statusCode,503);assert.equal(out.body.code,'AI_KEY_INVALID');
 assert.equal(calls.length,1);assert.equal(calls[0].key,'test-secret');
 assert.ok(!JSON.stringify(out.body).includes('test-secret'));
});
test('model-specific permission failure can recover using fallback model',async()=>{
 const {handler,calls}=build('model-permission'),out=response();
 await handler(request('198.51.100.111'),out);
 assert.equal(out.statusCode,200);assert.equal(out.body.reply,'Verified model response');
 assert.equal(calls.length,2);
 assert.ok(calls[1].url.includes('gemini-2.5-flash-lite'));
});
test('genuine provider response is returned as an answer',async()=>{
 const {handler,calls}=build('success'),out=response();
 await handler(request('198.51.100.112'),out);
 assert.equal(out.statusCode,200);
 assert.equal(out.body.reply,'Verified model response');
 assert.equal(calls.length,1);
});
