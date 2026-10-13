// Ravrent Mechanic diagnostic research API (private beta).
// No Gemini key is ever returned to the browser.
const crypto = require('node:crypto');
const attempts = new Map();
let searchPausedUntil = 0;
const MAX_HISTORY = 18;
function takeSlot(id) {
 const now=Date.now(), day=24*60*60*1000, row=attempts.get(id)||{start:now,n:0,dayStart:now,daily:0};
 if(now-row.start>60000){row.start=now;row.n=0;}
 if(now-row.dayStart>day){row.dayStart=now;row.daily=0;}
 row.n++;row.daily++;attempts.set(id,row);
 if(attempts.size>400){for(const [k,v] of attempts)if(now-v.dayStart>day)attempts.delete(k);}
 return row.n<=4&&row.daily<=30;
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
function conversation(messages) {
  const out=[];
  for(const m of messages.slice(-MAX_HISTORY)){
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
'You are Ravrent Mechanic, an elite automotive diagnostics and repair research assistant, not a canned chatbot.',
'Your job is to use all available evidence and explain a methodical differential diagnosis with high mechanical accuracy.',
'Be genuinely conversational. Respond to the user’s latest question in context; do not repeat the same boilerplate list.',
'Think through evidence internally. Do not present hidden chain-of-thought. Give a concise, useful diagnostic rationale.',
'For a substantive fault: provide (a) risk / safe-to-drive recommendation, (b) 2–5 plausible causes ranked by fit to symptoms,',
'(c) specific signs that support / contradict each possibility, (d) inexpensive safe verification tests ordered by information gained,',
'(e) what the test outcomes mean and recommended repair options, (f) 1–3 targeted follow-up questions.',
'For a simple question or a follow-up with already known facts, answer directly rather than rigidly using a template.',
'Do not invent fault percentages, test results, code definitions, safety ratings, torque specifications, wiring, TSBs, recalls, prices or part fits.',
'Use manufacturer service information, NHTSA, OEM bulletins and authoritative automotive sources when Google Search supplies them.',
'When you use web research, distinguish sourced statements from your inference and include readable citations if available.',
'Never claim to have researched online if the API did not supply search grounding.',
'Interpret OBD codes as system and circuit clues, not automatic replacement recommendations. Compare live data only when supplied.',
'If the driver says the car has weak brakes, loss of steering, fuel leakage, overheating, smoke, flashing check engine light,',
'or severe loss of power, advise stopping safely and seeking qualified repair or towing.',
'Avoid hazardous repair steps for high-voltage systems, airbags, refrigerants, pressurized fuel, or working under unsafe supports.',
'Video input may include visible motion AND recorded sound. Identify what can genuinely be seen and heard, including timestamps when useful; do not equate a recorded sound with a confirmed mechanical fault. There is no actual scanner data or physical inspection unless supplied.',
'User-maintained garage/service data may be inaccurate. Treat it as reported history, not independently verified facts.',
'Keep responses clear and appropriately detailed; precise checks before buying parts. Use Markdown headings and tables sparingly.'
].join('\n');
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
  if(!key)return res.status(503).json({error:'The assistant is not set up yet. The app owner needs to finish server configuration.',code:'NOT_CONFIGURED'});
  const remote=asText(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown',100).split(',')[0];
  if(!takeSlot(remote))return res.status(429).json({error:'Too many requests right now. Please wait before trying again.',code:'LOCAL_LIMIT'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  if(JSON.stringify(body).length>3_100_000)return res.status(413).json({error:'The message or attachment is too large.',code:'TOO_LARGE'});
  if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>60)
    return res.status(400).json({error:'The conversation is missing or too long.',code:'BAD_INPUT'});
  let contents;
  try{contents=conversation(body.messages);}
  catch(err){return res.status(400).json({error:err.message==='INVALID_IMAGE'?'Photo must be a JPEG, PNG, or WebP under 1.8 MB.':err.message==='INVALID_VIDEO'?'That video is unavailable or expired. Upload it again to continue.':'Conversation format is invalid.',code:'BAD_INPUT'});}
  const deep=body.deep===true,requestedResearch=body.research===true;
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
        maxOutputTokens:effort==='HIGH'?8500:effort==='MEDIUM'?5600:3600,
        thinkingConfig:{thinkingBudget:effort==='HIGH'?2048:effort==='MEDIUM'?768:0,includeThoughts:false}
      },
      ...(grounded?{tools:[{google_search:{}}]}:{})
    };
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(whichModel)+':generateContent',{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify(config)
    });
    if(!response.ok){
      let reason='';
      try{const errBody=await response.json();reason=asText(errBody?.error?.message,400);}catch(e){}
      console.warn('RAVRENT_AI_REQUEST_FAILED',{status:response.status,model:whichModel,grounded,reason:reason.slice(0,150)});
      return {ok:false,status:response.status,reason};
    }
    return {ok:true,json:await response.json(),model:whichModel,grounded};
  }
  try{
    // Search grounding is not included with the free tier of the advanced model.
    // Retry without search instead of failing with a quota message.
    let result=null,usedFallback=false;
    const wantSearch=requestedResearch&&Date.now()>=searchPausedUntil;
    if(wantSearch){
      result=await generate(model,true,deep?'HIGH':'MEDIUM');
      if(!result.ok&&(result.status===429||result.status===400||result.status===403)){
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
    if(result&&!result.ok&&(result.status===429||((result.status===403||result.status===404)&&/model|not supported|not found/i.test(result.reason||'')))&&!controller.signal.aborted&&model!=='gemini-2.5-flash-lite'){
      usedFallback=true;
      result=await generate('gemini-2.5-flash-lite',false,'LOW');
    }
    if(!result?.ok){
      const status=result?.status||502;
      if(status===429)return res.status(503).json({error:'The assistant is at its current usage limit. Please try again later.',code:'AI_QUOTA'});
      if(status===401||status===403){
        // Only return a safe classification, never raw provider text or key data.
        const reason=String(result.reason||'');
        const cls=/api.?key.+(invalid|expired)|invalid.+api.?key|api_key_invalid/i.test(reason)?'AI_KEY_INVALID':
          /service.disabled|api.+not.+enabled|generativelanguage.googleapis.com.+disabled/i.test(reason)?'AI_API_DISABLED':
          /referrer|ip address|api.?key.+restricted|request.+blocked/i.test(reason)?'AI_KEY_RESTRICTED':
          /billing|payment|required.+bill/i.test(reason)?'AI_BILLING':
          /model|permission/i.test(reason)?'AI_MODEL_ACCESS':'AI_AUTH';
        const details={
          AI_KEY_INVALID:'The Google AI API key is invalid or expired. The app owner needs to replace GEMINI_API_KEY in Vercel.',
          AI_API_DISABLED:'The Google Generative Language API is not enabled for the server key’s project.',
          AI_KEY_RESTRICTED:'The server key has restrictions that block this Vercel deployment.',
          AI_BILLING:'Google AI access for this project is blocked by billing or project payment requirements.',
          AI_MODEL_ACCESS:'The server key does not have permission to use the configured Gemini model.',
          AI_AUTH:'Google AI rejected the request. The app owner needs to verify API key validity, project permissions and restrictions.'
        };
        return res.status(503).json({error:details[cls],code:cls});
      }
      if(status===404)return res.status(503).json({error:'The configured AI model is not available to this project. The app owner must update the model setting.',code:'AI_MODEL'});
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
    return res.status(200).json({
      reply:answer.slice(0,17000),sources,researchRequested:requestedResearch,researchPerformed,
      researchNote:requestedResearch&&!researchPerformed?'Live research was unavailable. This answer is based on general vehicle knowledge and the details you provided.':null,
      mode:deep?'Deep diagnosis':'Quick response',
      modelParts:cleanParts,usedFallback
    });
  }catch(err){
    console.error('RAVRENT_AI_NETWORK',{aborted:controller.signal.aborted,name:err?.name});
    return res.status(503).json({error:controller.signal.aborted?'The request took too long. Please retry with a shorter question.':'The assistant is temporarily unavailable. Please retry shortly.',code:controller.signal.aborted?'TIMEOUT':'NETWORK'});
  }finally{clearTimeout(timer);}
};