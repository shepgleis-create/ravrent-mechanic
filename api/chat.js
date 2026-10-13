// Ravrent Mechanic diagnostic research API (private beta).
// No Gemini key is ever returned to the browser.
const crypto = require('node:crypto');
const {classifyGoogleError}=require('../lib/google-error');
const {callGroq}=require('../lib/groq-provider');
const meter=require('../lib/usage-meter');
const attempts = new Map();
let searchPausedUntil = 0;
const MAX_HISTORY = 14;
function takeSlot(id) {
 const now=Date.now(), day=24*60*60*1000, row=attempts.get(id)||{start:now,n:0,dayStart:now,daily:0};
 if(now-row.start>60000){row.start=now;row.n=0;}
 if(now-row.dayStart>day){row.dayStart=now;row.daily=0;}
 row.n++;row.daily++;attempts.set(id,row);
 if(attempts.size>400){for(const [k,v] of attempts)if(now-v.dayStart>day)attempts.delete(k);}
 return row.n<=8&&row.daily<=50;
}
const asText = (v,max=250)=>typeof v==='string'?v.slice(0,max):typeof v==='number'?String(v).slice(0,max):'';
function vehicleContext(v) {
  if(!v||typeof v!=='object')return 'No vehicle selected yet.';
  const vehicle=[v.year,v.make,v.model,v.engine,v.miles?String(v.miles)+' miles':''].map(x=>asText(x,80)).filter(Boolean).join(' ');
  const history=Array.isArray(v.service)?v.service.slice(-12).map(s=>{
    if(!s||typeof s!=='object')return '';
    return [asText(s.date,30),asText(s.type,35),asText(s.miles,12),asText(s.note,350)].filter(Boolean).join(' | ');
  }).filter(Boolean).join('\n'):'';
  return (vehicle||'Vehicle details unavailable.')+(history?'\nOwner-reported repair and maintenance notes:\n'+history.slice(0,3500):'');
}
function userParts(m) {
  const parts=[{text:asText(m.text,3200)}];
  if(typeof m.image==='string') {
    const match=m.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/);
    if(!match||match[2].length>2_500_000)throw Error('INVALID_IMAGE');
    parts.push({inline_data:{mime_type:match[1],data:match[2]}});
  }
  if(m.video&&typeof m.video==='object') {
    const uri=String(m.video.uri||''),name=String(m.video.name||'');
    const mime=String(m.video.mimeType||'');
    const age=Date.now()-Number(m.video.uploadedAt||0);
    const valid=/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/[A-Za-z0-9_-]+$/.test(uri)&&
      /^files\/[A-Za-z0-9_-]+$/.test(name)&&uri.endsWith('/'+name)&&
      ['video\/mp4','video\/mov','video\/webm','video\/mpeg','video\/3gpp'].includes(mime)&&
      age>=0&&age<47*60*60*1000;
    if(age>=47*60*60*1000){
      parts.push({text:'An earlier video attachment has expired. If the recording is needed for further diagnosis, ask the user to upload it again.'});
    }else{
      if(!valid)throw Error('INVALID_VIDEO');
      parts.push({file_data:{mime_type:mime,file_uri:uri}});
    }
  }
  return parts;
}
function conversation(messages,deep=false) {
  const out=[];
  for(const m of messages.slice(-(deep?MAX_HISTORY:9))){
    if(!m||typeof m!=='object'||!['assistant','user'].includes(m.role))continue;
    if(m.role==='user'){
      out.push({role:'user',parts:userParts(m)});
    }else{
      // Keep Gemini's original model parts and thought signatures across turns when available.
      const valid=Array.isArray(m.modelParts)&&m.modelParts.length<=12&&
        JSON.stringify(m.modelParts).length<32_000&&m.modelParts.every(p=>p&&typeof p==='object'&&
          (typeof p.text==='string'||typeof p.thoughtSignature==='string'));
      if(valid)out.push({role:'model',parts:m.modelParts});
      else out.push({role:'model',parts:[{text:asText(m.text,11000)}]});
    }
  }
  while(out.length&&out[0].role!=='user')out.shift();
  if(out.at(-1)?.role!=='user')throw Error('LAST_NOT_USER');
  return out;
}
const system = [
'You are Ravrent Mechanic, an expert automotive diagnostic assistant. Answer in the context of the exact vehicle, mileage, codes, symptoms, and prior tests supplied.',
'Clearly distinguish observed evidence, user reports, general patterns, and unverified hypotheses. Never invent tests, DTC definitions, recall status, fitment, repair prices or verified repairs.',
'Prioritize safety: for dangerous braking, steering, fuel leaks, smoke, severe overheating, flashing check engine lamps, high-voltage hazards or major electrical failures, advise stopping safely and getting professional help.',
'When investigating a fault, rank a short differential diagnosis by evidence. For each cause give supporting or contradicting clues and an inexpensive, safe next test with expected outcomes.',
'Prefer electrical, mechanical and live-data verification to replacing sensors on the basis of codes. Explain the next best test first. Interpret codes as system clues, not proof of a failed part.',
'Ask at most two targeted follow-up questions if details are insufficient, or answer directly if enough information is present. Do not repeat generic boilerplate.',
'If actual readings, measurements or video are not provided, say so. For video, distinguish sounds and visuals from mechanical conclusions.',
'Never give unsupported safety-critical torque, refrigerant, airbag, high-voltage or pressurized-fuel instructions. Refer to verified vehicle-specific service material.',
'Only cite web sources if grounding metadata was returned; never invent citations. Distinguish general knowledge from current manufacturer information.',
'Keep the answer technically useful but concise. For complex cases use: immediate risk, ranked causes, next tests, and when a shop is necessary.'
].join('\\n');
function usableUrl(s) {try{const u=new URL(s);return u.protocol==='https:'&&u.hostname.length>3?u.href:null;}catch{return null;}}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST required',code:'METHOD'});}
  // This endpoint runs behind the website, with its provider key on the server.
  // Browser same-origin validation and in-instance quotas help prevent casual misuse,
  // but do NOT replace production account authentication and distributed rate limits.
  const origin=req.headers?.origin,host=req.headers?.host;
  if(origin&&host){try{if(new URL(origin).host!==host)return res.status(403).json({error:'This request must come from the app.',code:'ORIGIN'});}catch{ return res.status(403).json({error:'Invalid request origin.',code:'ORIGIN'});}}
  if(process.env.AI_REQUESTS_ENABLED==='false')return res.status(503).json({error:'AI chat is temporarily paused by the app owner. Offline guided diagnostics remain available.',code:'OWNER_PAUSED'});
  const key=String(process.env.GEMINI_API_KEY||'').trim();
  const groqKey=String(process.env.GROQ_API_KEY||'').trim();
  const preference=String(process.env.AI_PROVIDER||'auto').trim().toLowerCase();
  const useGroq=preference==='groq'||(preference!=='gemini'&&Boolean(groqKey));
  if(useGroq&&!groqKey)return res.status(503).json({error:'GroqCloud is selected but GROQ_API_KEY is not configured on the server.',code:'NOT_CONFIGURED'});
  if(!useGroq&&!key)return res.status(503).json({error:'No AI provider is configured yet. Add GROQ_API_KEY to switch to open-weight models, or configure Gemini.',code:'NOT_CONFIGURED'});
  const remote=asText(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown',100).split(',')[0];
  if(!takeSlot(remote))return res.status(429).json({error:'Too many requests right now. Please wait before trying again.',code:'LOCAL_LIMIT'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  if(JSON.stringify(body).length>3_100_000)return res.status(413).json({error:'The message or attachment is too large.',code:'TOO_LARGE'});
  if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>60)
    return res.status(400).json({error:'The conversation is missing or too long.',code:'BAD_INPUT'});
  let contents;
  try{contents=conversation(body.messages,body.deep===true);}
  catch(err){return res.status(400).json({error:err.message==='INVALID_IMAGE'?'Photo must be a JPEG, PNG, or WebP under 1.8 MB.':err.message==='INVALID_VIDEO'?'That video is unavailable or expired. Upload it again to continue.':'Conversation format is invalid.',code:'BAD_INPUT'});}
  const deep=body.deep===true,requestedResearch=body.research===true;
  let reservation=null;
  try{reservation=await meter.reserve({remote,fetcher:fetch})}
  catch{ return res.status(503).json({code:'USAGE_METER_UNAVAILABLE',error:'The usage service is temporarily unavailable. No AI credit was used. Try again later.'}) }
  if(reservation.active&&!reservation.allowed){
    res.setHeader('Retry-After',String(reservation.retryAfterSeconds));
    return res.status(429).json({code:'APP_USAGE_LIMIT',error:reservation.scope==='day'?'This beta device/network reached its daily AI allowance. New conversations do not reset it.':'Too many AI requests in a minute. Please wait before trying again.',retryAfterSeconds:reservation.retryAfterSeconds,limitScope:reservation.scope});
  }
  const releaseReservation=()=>meter.release({reservation,fetcher:fetch});
  if(useGroq){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),53000);
    try{
      const reply=await callGroq({
        key:groqKey,contents,
        vehiclePrompt:[
          'Ravrent Mechanic: provide evidence-based vehicle diagnostics; keep replies useful and focused.',
          'Treat codes as clues, never proof of a defective component. Rank 2-3 causes and give the cheapest safe next test.',
          'Separate observed facts from guesses. When vehicle data or measurements are missing, ask only needed follow-ups.',
          'Warn about flashing CEL, unsafe brakes/steering, overheating, fuel leaks and other urgent safety hazards.',
          'Do not invent recalls, repairs, tested measurements, current sources, part fitment, or pricing.',
          'Vehicle: '+vehicleContext(body.vehicle).slice(0,850)
        ].join('\n'),
        deep,requestedResearch,signal:controller.signal,fetcher:fetch,
        standardModel:process.env.GROQ_TEXT_MODEL||'qwen/qwen3.8-27b',
        visionModel:process.env.GROQ_VISION_MODEL||'qwen/qwen3.8-27b'
      });
      if(!reply.ok){
        await releaseReservation();
        if(reply.retryAfterSeconds)res.setHeader('Retry-After',String(reply.retryAfterSeconds));
        return res.status(reply.status===400?400:reply.status===429?429:503).json({error:reply.message,code:reply.code,
          retryAfterSeconds:reply.retryAfterSeconds||null,rateLimitScope:reply.rateLimitScope||null,
          provider:'Groq'});
      }
      return res.status(200).json({...reply,usageLimit:reservation.active?{scope:'anonymous_beta',remainingToday:Math.max(0,reservation.limitToday-reservation.usedToday)}:null});
    }catch(error){
      await releaseReservation();
      console.warn('RAVRENT_GROQ_REQUEST_FAILED',{code:controller.signal.aborted?'TIMEOUT':'NETWORK',name:error?.name});
      return res.status(503).json({error:controller.signal.aborted?'The open-weight AI request timed out. Try a shorter question.':'GroqCloud could not complete the request. Check the provider connection.',code:controller.signal.aborted?'TIMEOUT':'GROQ_NETWORK'});
    }finally{clearTimeout(timer)}
  }
  const model=deep?(process.env.GEMINI_MODEL||'gemini-2.5-flash'):(process.env.GEMINI_STANDARD_MODEL||'gemini-2.5-flash-lite');
  if(!/^gemini-[a-z0-9.-]{3,48}$/.test(model))return res.status(503).json({error:'The assistant is not configured correctly.',code:'MODEL_CONFIG'});
  const prompt=system+'\n\nCURRENT VEHICLE:\n'+vehicleContext(body.vehicle);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),53000);
  const base={systemInstruction:{parts:[{text:prompt}]},contents};
  async function generate(whichModel,grounded,effort){
    const config={
      ...base,
      generationConfig:{
        maxOutputTokens:effort==='HIGH'?4500:effort==='MEDIUM'?3100:2200,
        thinkingConfig:{thinkingBudget:effort==='HIGH'?1200:effort==='MEDIUM'?480:0,includeThoughts:false}
      },
      ...(grounded?{tools:[{google_search:{}}]}:{})
    };
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(whichModel)+':generateContent',{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify(config)
    });
    if(!response.ok){
      let errorBody={};
      try{errorBody=await response.json();}catch(e){}
      const cause=classifyGoogleError(response.status,errorBody);
      console.warn('RAVRENT_AI_REQUEST_FAILED',{status:response.status,code:cause.code,model:whichModel,grounded});
      return {ok:false,status:response.status,cause};
    }
    return {ok:true,json:await response.json(),model:whichModel,grounded};
  }
  let geminiFinished=false;
  try{
    // Search grounding is not included with the free tier of the advanced model.
    // Retry without search instead of failing with a quota message.
    let result=null,usedFallback=false;
    const wantSearch=requestedResearch&&Date.now()>=searchPausedUntil;
    if(wantSearch){
      result=await generate(model,true,deep?'HIGH':'MEDIUM');
      if(!result.ok&&(result.status===429||result.status===400)){
        searchPausedUntil=Date.now()+20*60*1000;
        usedFallback=true;
        if(!controller.signal.aborted)result=await generate(model,false,deep?'MEDIUM':'LOW');
      }
    }else{
      result=await generate(model,false,deep?'HIGH':'MEDIUM');
      if(requestedResearch)usedFallback=true;
    }
    // If the main model's allowance is exhausted, try a separately provisioned,
    // lower-cost model once. No silent template responses.
    if(result&&!result.ok&&(result.status===429||result.cause?.code==='AI_MODEL_ACCESS'||result.cause?.code==='AI_MODEL')&&!controller.signal.aborted&&model!=='gemini-2.5-flash-lite'){
      usedFallback=true;
      result=await generate('gemini-2.5-flash-lite',false,'LOW');
    }
    if(!result?.ok){
      const status=result?.status||502;
      if(status===429)return res.status(503).json({error:'The assistant is at its current usage limit. Please try again later.',code:'AI_QUOTA'});
      if(status===401||status===403||status===400||status===404){
        const issue=result.cause||{code:'AI_PROVIDER_ERROR',action:'Check Google AI project access.'};
        return res.status(503).json({error:issue.action,code:issue.code});
      }
      return res.status(503).json({error:'The assistant could not complete this request. Please try again.',code:'AI_REQUEST'});
    }
    const json=result.json,candidate=json.candidates?.[0];
    const parts=candidate?.content?.parts||[];
    const answer=parts.filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('\n').trim();
    if(!answer)return res.status(503).json({error:'The assistant did not generate an answer. Try a shorter question.',code:'EMPTY_RESPONSE'});
    const grounding=candidate?.groundingMetadata||{};
    const sources=(grounding.groundingChunks||[]).map(chunk=>chunk?.web).filter(Boolean)
      .map(w=>({title:asText(w.title,150),url:usableUrl(w.uri)}))
      .filter(x=>x.url).filter((x,n,a)=>a.findIndex(z=>z.url===x.url)===n).slice(0,10);
    const researchPerformed=Boolean(result.grounded&&((grounding.webSearchQueries||[]).length||sources.length));
    const cleanParts=parts.filter(p=>!p.thought).map(p=>{
      const x={};if(typeof p.text==='string')x.text=p.text.slice(0,15000);
      if(typeof p.thoughtSignature==='string')x.thoughtSignature=p.thoughtSignature.slice(0,30000);
      return x;
    }).filter(p=>p.text||p.thoughtSignature).slice(0,12);
    geminiFinished=true;
    return res.status(200).json({
      reply:answer.slice(0,17000),sources,researchRequested:requestedResearch,researchPerformed,
      researchNote:requestedResearch&&!researchPerformed?'Live research was unavailable. This answer is based on general vehicle knowledge and the details you provided.':null,
      mode:deep?'Deep diagnosis':'Quick response',
      modelParts:cleanParts,usedFallback
    });
  }catch(err){
    console.error('RAVRENT_AI_NETWORK',{aborted:controller.signal.aborted,name:err?.name});
    return res.status(503).json({error:controller.signal.aborted?'The request took too long. Please retry with a shorter question.':'The assistant is temporarily unavailable. Please retry shortly.',code:controller.signal.aborted?'TIMEOUT':'NETWORK'});
  }finally{clearTimeout(timer);if(!geminiFinished)await releaseReservation();}
};