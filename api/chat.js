// Ravrent Mechanic diagnostic research API (private beta).
// No Gemini key is ever returned to the browser.
const crypto = require('node:crypto');
const attempts = new Map();
const MAX_HISTORY = 18;
function fixedEquals(a,b) {
  const x=crypto.createHash('sha256').update(String(a||'')).digest();
  const y=crypto.createHash('sha256').update(String(b||'')).digest();
  return crypto.timingSafeEqual(x,y);
}
function takeSlot(id) {
  // Best-effort protection on this process. A shared rate limiter and account auth
  // MUST be added before a public release.
  const now=Date.now(), row=attempts.get(id)||{start:now,n:0};
  if(now-row.start>60_000){row.start=now;row.n=0;}
  row.n++; attempts.set(id,row);
  if(attempts.size>300){for(const [k,v] of attempts)if(now-v.start>120_000)attempts.delete(k);}
  return row.n<=6;
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
'Visual image input is limited to what is visible; audio and live scanner data are unavailable unless explicitly attached/supplied.',
'User-maintained garage/service data may be inaccurate. Treat it as reported history, not independently verified facts.',
'Keep responses clear and appropriately detailed; precise checks before buying parts. Use Markdown headings and tables sparingly.'
].join('\n');
function usableUrl(s) {try{const u=new URL(s);return u.protocol==='https:'&&u.hostname.length>3?u.href:null;}catch{return null;}}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST required'});}
  const key=process.env.GEMINI_API_KEY;
  const code=process.env.MECHANIC_ACCESS_CODE;
  if(!key||!code)return res.status(503).json({error:'Gemini is not configured on Vercel. Add GEMINI_API_KEY and MECHANIC_ACCESS_CODE, then redeploy.',code:'NOT_CONFIGURED'});
  if(!fixedEquals(req.headers['x-app-passcode'],code))return res.status(401).json({error:'Private access code is incorrect.',code:'BAD_ACCESS_CODE'});
  const remote=asText(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown',100).split(',')[0];
  if(!takeSlot(remote))return res.status(429).json({error:'Request limit reached. Please wait about a minute.',code:'LOCAL_LIMIT'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>60)
    return res.status(400).json({error:'Conversation is missing or too long.',code:'BAD_INPUT'});
  let contents;
  try{contents=conversation(body.messages);}
  catch(err){return res.status(400).json({error:err.message==='INVALID_IMAGE'?'Photo must be JPEG, PNG, or WebP under 1.8 MB.':'Conversation format is invalid.',code:'BAD_INPUT'});}
  const model=process.env.GEMINI_MODEL||'gemini-3.8-flash';
  if(!/^gemini-[a-z0-9.-]{3,48}$/.test(model))return res.status(503).json({error:'Invalid model configured.',code:'MODEL_CONFIG'});
  const deep=body.deep!==false;
  const research=body.research!==false;
  const config={
    systemInstruction:{parts:[{text:system+'\n\nCURRENT VEHICLE:\n'+vehicleContext(body.vehicle)}]},
    contents,
    generationConfig:{temperature:0.3,maxOutputTokens:deep?9000:3500,
      thinkingConfig:{thinkingLevel:deep?'HIGH':'MEDIUM',includeThoughts:false}},
    ...(research?{tools:[{google_search:{}}]}:{})
  };
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),54000);
  try{
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
      method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify(config)
    });
    if(!response.ok){
      const status=response.status;
      if(status===429)return res.status(429).json({error:'Gemini quota or Google Search grounding limit reached. Check quota/billing in AI Studio.',code:'GOOGLE_QUOTA'});
      if(status===401||status===403)return res.status(502).json({error:'Google rejected this API key or project permission. Check the key and billing.',code:'GOOGLE_AUTH'});
      if(status===404)return res.status(502).json({error:'The configured Gemini model is unavailable for your Google project.',code:'GOOGLE_MODEL'});
      if(status===400)return res.status(502).json({error:'Gemini rejected the request or search configuration. Check the selected model.',code:'GOOGLE_REQUEST'});
      return res.status(502).json({error:'Gemini request failed with status '+status+'.',code:'GOOGLE_UPSTREAM'});
    }
    const json=await response.json(), candidate=json.candidates?.[0];
    const modelParts=candidate?.content?.parts||[];
    const answer=modelParts.filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('\n').trim();
    if(!answer)return res.status(502).json({error:'Gemini returned no usable answer. Try again or lower reasoning effort.',code:'EMPTY_RESPONSE'});
    const grounding=candidate?.groundingMetadata||{};
    const sources=(grounding.groundingChunks||[]).map(chunk=>chunk?.web)
      .filter(Boolean).map(w=>({title:asText(w.title,150),url:usableUrl(w.uri)}))
      .filter(x=>x.url).filter((s,i,arr)=>arr.findIndex(v=>v.url===s.url)===i).slice(0,10);
    const researchDone=Boolean((grounding.webSearchQueries||[]).length||sources.length);
    const safeParts=modelParts.filter(p=>!p.thought).map(p=>{
      const out={}; if(typeof p.text==='string')out.text=p.text.slice(0,15000);
      if(typeof p.thoughtSignature==='string')out.thoughtSignature=p.thoughtSignature.slice(0,30000);
      return out;
    }).filter(p=>p.text||p.thoughtSignature).slice(0,12);
    return res.status(200).json({
      reply:answer.slice(0,16000),sources,researchRequested:research,researchPerformed:researchDone,
      searchQueries:(grounding.webSearchQueries||[]).filter(x=>typeof x==='string').slice(0,8),
      model,mode:deep?'Deep diagnosis':'Quick answer',
      usage:{input:json.usageMetadata?.promptTokenCount||null,output:json.usageMetadata?.candidatesTokenCount||null,thinking:json.usageMetadata?.thoughtsTokenCount||null},
      modelParts:safeParts
    });
  }catch(err){
    return res.status(502).json({error:controller.signal.aborted?'Deep research timed out. Try again or switch to Quick mode.':'Cannot reach Gemini right now. Try again.',code:controller.signal.aborted?'TIMEOUT':'NETWORK'});
  }finally{clearTimeout(timer);}
};