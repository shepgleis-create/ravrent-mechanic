const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {callGroq,compactMessages,rateDetails}=require('../lib/groq-provider');
const {callTogether}=require('../lib/together-provider');
const meter=require('../lib/usage-meter');
const headers=data=>({get:name=>data[name.toLowerCase()]??null});
const user=[{role:'user',parts:[{text:'Vehicle shakes only when cold. What should I test?'}]}];
test('Groq 429 identifies token-per-minute exhaustion and reports retry window safely',async()=>{
 const reply=await callGroq({key:'test-secret',contents:user,vehiclePrompt:'Vehicle',
  fetcher:async()=>({ok:false,status:429,headers:headers({'retry-after':'43','x-ratelimit-remaining-tokens':'0','x-ratelimit-remaining-requests':'100'}),json:async()=>({error:{message:'TPM limit reached for token usage'}})})});
 assert.equal(reply.ok,false);assert.equal(reply.code,'AI_QUOTA');
 assert.equal(reply.rateLimitScope,'tokens_per_minute');assert.equal(reply.retryAfterSeconds,43);
 assert.doesNotMatch(JSON.stringify(reply),/test-secret/);
});
test('shortening conversation excludes previous images and truncates long outputs',()=>{
 const long='A'.repeat(8000);
 const messages=[{role:'user',content:[{type:'text',text:'see clip'},{type:'image_url',image_url:{url:'data:image/jpeg;base64,AA=='}}]},
  {role:'assistant',content:long},{role:'user',content:'Next question'}];
 const clean=compactMessages(messages,{deep:false});
 assert.equal(clean.length,3);assert.equal(clean[0].content.some(x=>x.type==='image_url'),false);
 assert.equal(clean[1].content.length,600);assert.equal(clean.at(-1).content,'Next question');
});
test('Together uses correct paid serverless endpoint, never includes credentials in result',async()=>{
 const calls=[];
 const out=await callTogether({key:'a-secret-value',contents:user,vehiclePrompt:'2009 Lexus IS 250',
  fetcher:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>({choices:[{message:{content:'Check charging voltage first.'}}],usage:{prompt_tokens:320,completion_tokens:85}})}}});
 assert.equal(out.ok,true);assert.equal(out.provider,'Together AI');
 assert.equal(out.usage.inputTokens,320);assert.equal(out.usage.outputTokens,85);
 assert.equal(calls[0].url,'https://api.together.xyz/v1/chat/completions');
 assert.equal(JSON.parse(calls[0].opts.body).model,'Qwen/Qwen3.8-Flash');
 assert.doesNotMatch(JSON.stringify(out),/a-secret-value/);
});
test('distributed usage budget is off without configured Redis and never stores a raw IP',async()=>{
 const check=await meter.reserve({remote:'198.51.100.77',env:{}});
 assert.equal(check.active,false);assert.equal(check.allowed,true);
 const env={UPSTASH_REDIS_REST_URL:'https://myaccount.upstash.io',UPSTASH_REDIS_REST_TOKEN:'abcdefghijklmnop',USAGE_METER_SECRET:'abcdefghijklmnopqrstuvwxyz123456789',FREE_AI_DAILY_LIMIT:'50'};
 assert.equal(meter.configured(env),true);
 const keys=meter.keysFor('198.51.100.77',env,Date.UTC(2026,9,13,12));
 assert.equal(keys.length,2);assert.doesNotMatch(keys.join(' '),/198\.51/);
 const arr=[];
 const reserved=await meter.reserve({remote:'198.51.100.77',env,now:Date.UTC(2026,9,13,12),fetcher:async(url,opts)=>{arr.push(JSON.parse(opts.body));return {ok:true,json:async()=>({result:[1,0,1,1]})}}});
 assert.equal(reserved.active,true);assert.equal(reserved.allowed,true);assert.equal(reserved.limitToday,50);
 assert.equal(arr.length,1);assert.equal(arr[0][0],'EVAL');
});
test('rate budget is not a paid subscription entitlement or identity claim',()=>{
 assert.equal(meter.limitSettings({FREE_AI_DAILY_LIMIT:'999999'}).daily,20);
 assert.equal(meter.limitSettings({FREE_AI_DAILY_LIMIT:'60',FREE_AI_MINUTE_LIMIT:'6'}).daily,60);
 assert.equal(typeof meter.anonymize('127.0.0.1','a sufficient secret'), 'string');
});
