// Ravrent Mechanic Gemini API backend — private-test-only.
// GEMINI_API_KEY is read server-side and never sent to visitors.
const crypto = require('node:crypto');
const buckets = new Map();
function same(a,b) {
  const x=Buffer.from(String(a||'')), y=Buffer.from(String(b||''));
  return x.length===y.length && crypto.timingSafeEqual(x,y);
}
function takeSlot(address) {
  // Best-effort protection per serverless instance; public release needs a shared limiter.
  const now=Date.now(), row=buckets.get(address)||{since:now,n:0};
  if(now-row.since>=60_000){row.since=now;row.n=0;}
  row.n++;buckets.set(address,row);
  if(buckets.size>600){for(const [k,v] of buckets)if(now-v.since>120_000)buckets.delete(k);}
  return row.n<=8;
}
function vehicleContext(vehicle) {
  if(!vehicle||typeof vehicle!=='object')return 'Vehicle not specified.';
  const parts=[vehicle.year,vehicle.make,vehicle.model,vehicle.engine,
    vehicle.miles?String(vehicle.miles)+' miles':''];
  const basics=parts.filter(v=>typeof v==='string'||typeof v==='number').join(' ').slice(0,220);
  const history=Array.isArray(vehicle.service)?vehicle.service.slice(-12).map(item=>{
    if(!item||typeof item!=='object')return '';
    return [item.date,item.kind,item.miles?String(item.miles)+' miles':'',item.note]
      .filter(v=>typeof v==='string'||typeof v==='number').join(': ').slice(0,250);
  }).filter(Boolean).join('; ').slice(0,1600):'';
  return basics+(history?' | Recorded maintenance/repairs: '+history:'');
}
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST'});}
  const key=process.env.GEMINI_API_KEY, access=process.env.MECHANIC_ACCESS_CODE;
  if(!key||!access)return res.status(503).json({error:'Gemini API is not configured on Vercel'});
  if(!same(req.headers['x-app-passcode'],access))return res.status(401).json({error:'Invalid private access code'});
  const client=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown')
    .split(',')[0].trim().slice(0,90);
  if(!takeSlot(client))return res.status(429).json({error:'Too many requests; retry in a minute'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const raw=Array.isArray(body.messages)?body.messages.slice(-12):[];
  if(!raw.length)return res.status(400).json({error:'Missing conversation'});
  const contents=[];
  for(let i=0;i<raw.length;i++){
    const m=raw[i];
    if(!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string')continue;
    const parts=[{text:m.text.slice(0,1700)}];
    if(i===raw.length-1&&m.role==='user'&&typeof m.image==='string'){
      const match=m.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/);
      if(!match||match[2].length>2_700_000)
        return res.status(400).json({error:'Photo must be a JPEG, PNG or WebP under 2 MB'});
      parts.push({inline_data:{mime_type:match[1],data:match[2]}});
    }
    contents.push({role:m.role==='user'?'user':'model',parts});
  }
  while(contents.length&&contents[0].role!=='user')contents.shift();
  if(!contents.length||contents.at(-1).role!=='user')
    return res.status(400).json({error:'Conversation must end with a user message'});
  const prompt='You are Ravrent Mechanic, a careful, vehicle-specific AI automotive diagnostic assistant. '+
    'Vehicle context: '+vehicleContext(body.vehicle)+'. '+
    'Identify urgency, ask relevant clarifying questions, list plausible competing causes, and '+
    'recommend the cheapest safe discriminating tests before parts replacement. '+
    'Treat stored repair history as user notes, not verified facts. Be transparent about uncertainty; '+
    'never invent confidence percentages, repair prices, recall/TSB details, component locations, '+
    'torque specs, or wiring details. When photos are provided, analyze only what is visible; '+
    'do not claim to diagnose hidden mechanical faults from a photo. '+
    'For unsafe brakes, steering loss, fuel leaks, overheating, smoke, a flashing check engine light '+
    'or severe drivability loss, advise safely stopping and requesting towing or professional inspection. '+
    'Avoid hazardous DIY instructions for fuel, high-voltage, airbag, or refrigerant systems. '+
    'Separate observations from possible causes and tests. Keep replies practical, concise, and '+
    'explicit that this is not a confirmed diagnosis.';
  const model=process.env.GEMINI_MODEL||'gemini-3.8-flash';
  if(!/^gemini-[a-z0-9.-]{3,48}$/.test(model))
    return res.status(503).json({error:'Invalid server model configuration'});
  const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),20000);
  try{
    const reply=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({
        systemInstruction:{parts:[{text:prompt}]},
        contents,
        generationConfig:{maxOutputTokens:1150,temperature:0.25}
      })
    });
    if(!reply.ok){
      if(reply.status===429)return res.status(429).json({error:'Google Gemini is rate-limiting requests or quota is exhausted'});
      if(reply.status===403)return res.status(502).json({error:'Google Gemini denied access; check key and billing permissions'});
      if(reply.status===404)return res.status(502).json({error:'Gemini model unavailable for this project; check GEMINI_MODEL'});
      return res.status(502).json({error:'Google Gemini request failed ('+reply.status+')'});
    }
    const result=await reply.json();
    const answer=(result.candidates?.[0]?.content?.parts||[]).map(p=>typeof p.text==='string'?p.text:'').join('\n').trim();
    if(!answer)return res.status(502).json({error:'Google returned no text; try a different wording'});
    return res.status(200).json({reply:answer.slice(0,8000),provider:'gemini',model});
  }catch(err){
    return res.status(502).json({error:'Unable to reach Gemini; check service status'});
  }finally{clearTimeout(timeout);}
};