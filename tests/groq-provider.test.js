const test=require('node:test');
const assert=require('node:assert/strict');
const {callGroq,checkGroqModels,convertMessages}=require('../lib/groq-provider');
const key='private-test-key';
function user(text){return [{role:'user',parts:[{text}]}]}
test('open-weight provider converts automotive turns without sending thought signatures',()=>{
 const converted=convertMessages([{role:'user',parts:[{text:'P0300 on a 2009 sedan'}]},{role:'model',parts:[{text:'Check codes and fuel trims',thoughtSignature:'internal-secret'}]},{role:'user',parts:[{text:'It misfires on cold start'}]}]);
 assert.equal(converted.messages.length,3);
 assert.equal(converted.messages[1].role,'assistant');
 assert.equal(converted.messages[1].content,'Check codes and fuel trims');
 assert.ok(!JSON.stringify(converted).includes('internal-secret'));
});
test('Economy text model returns genuine content with no fabricated web sources',async()=>{
 const calls=[];
 const result=await callGroq({key,contents:user('What should I test first?'),vehiclePrompt:'Vehicle: 2009 Lexus IS250',requestedResearch:true,
  fetcher:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>({choices:[{message:{content:'Check power supply and engine grounds first.'}}]})}}});
 assert.equal(result.ok,true);
 assert.equal(result.provider,'Groq');
 assert.equal(result.model,'openai/gpt-oss-20b');
 assert.match(result.reply,/engine grounds/);
 assert.equal(result.researchPerformed,false);
 assert.equal(result.sources.length,0);
 assert.match(result.researchNote,/Live web search is not connected/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.headers.Authorization,'Bearer '+key);
 const sent=JSON.parse(calls[0].opts.body);
 assert.equal(sent.model,'openai/gpt-oss-20b');
 assert.equal(sent.reasoning_effort,'low');
 assert.equal(sent.include_reasoning,false);
 assert.ok(sent.messages[0].content.includes('2009 Lexus'));
 assert.ok(!JSON.stringify(result).includes(key));
});
test('vehicle photos route to Qwen vision model, with text and images',async()=>{
 const calls=[];
 const contents=[{role:'user',parts:[{text:'Look for visible leaks.'},{inline_data:{mime_type:'image/jpeg',data:'AA=='}}]}];
 const r=await callGroq({key,contents,vehiclePrompt:'2009 Lexus',fetcher:async(url,opts)=>{calls.push(JSON.parse(opts.body));return {ok:true,json:async()=>({choices:[{message:{content:'Image is too small to determine a leak.'}}]})}}});
 assert.equal(r.model,'qwen/qwen3.8-27b');
 assert.equal(calls[0].messages[1].content[1].type,'image_url');
 assert.equal(calls[0].messages[1].content[1].image_url.url,'data:image/jpeg;base64,AA==');
});
test('Google-uploaded video is explicitly unsupported by Groq, with no network call',async()=>{
 let called=false;
 const r=await callGroq({key,contents:[{role:'user',parts:[{text:'Analyze this video'},{file_data:{mime_type:'video/mp4',file_uri:'https://example.com'}}]}],
  fetcher:async()=>{called=true;throw Error('unexpected')}});
 assert.equal(called,false);
 assert.equal(r.code,'VIDEO_UNSUPPORTED');
 assert.match(r.message,/still frames/i);
});
test('wrong Groq key and rate limits return safe status, not raw provider response',async()=>{
 for(const [status,want] of [[401,'GROQ_KEY_INVALID'],[429,'AI_QUOTA'],[503,'GROQ_UNAVAILABLE']]){
  const res=await callGroq({key,contents:user('Test'),fetcher:async()=>({ok:false,status,json:async()=>({error:{message:'provider debug private-test-key internal'}})})});
  assert.equal(res.ok,false);
  assert.equal(res.code,want);
  assert.ok(!JSON.stringify(res).includes(key));
 }
});
test('model listing checks selected Llama and Qwen models, not live generation',async()=>{
 const r=await checkGroqModels({key,fetcher:async(url,opts)=>{
  assert.match(url,/\/models$/);
  assert.equal(opts.headers.Authorization,'Bearer '+key);
  return {ok:true,json:async()=>({data:[{id:'openai/gpt-oss-20b'},{id:'qwen/qwen3.8-27b'}]})}
 }});
 assert.equal(r.status,'provider_access_ok');
 assert.equal(r.standardModelListed,true);
 assert.equal(r.deepModelListed,true);
 assert.match(r.note,/real chat/);
});
