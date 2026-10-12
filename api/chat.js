// Optional private-test AI endpoint. Does not store chat data.
const crypto = require('node:crypto');
function equals(a,b) {
  const x=Buffer.from(String(a||'')), y=Buffer.from(String(b||''));
  return x.length===y.length && crypto.timingSafeEqual(x,y);
}
module.exports=async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') { res.setHeader('Allow','POST'); return res.status(405).json({error:'POST required'}); }
  const apiKey=process.env.OPENAI_API_KEY, code=process.env.MECHANIC_ACCESS_CODE;
  if(!apiKey||!code) return res.status(503).json({error:'Live AI has not been configured'});
  if(!equals(req.headers['x-app-passcode'],code)) return res.status(401).json({error:'Invalid access code'});
  const payload=req.body&&typeof req.body==='object'?req.body:{};
  const raw=Array.isArray(payload.messages)?payload.messages.slice(-12):[];
  const messages=raw.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.text==='string')
    .map(m=>({role:m.role,content:m.text.slice(0,1700)}));
  if(!messages.length||messages[messages.length-1].role!=='user')return res.status(400).json({error:'Invalid messages'});
  const v=payload.vehicle&&typeof payload.vehicle==='object'?payload.vehicle:{};
  const details=[v.year,v.make,v.model,v.engine,v.mileage||v.miles].filter(x=>typeof x==='string'||typeof x==='number')
    .join(' ').slice(0,250);
  const system='You are Ravrent Mechanic, a careful automotive troubleshooting assistant. '+ 
    'Vehicle: '+details+'. Distinguish observations from possible causes. Ask focused follow-up questions, '+
    'recommend safe, economical diagnostic checks before parts replacement, and identify safety urgency. '+
    'Never invent service specs, wiring, torque values, recalls, or probabilities; advise checking verified manufacturer service data. '+
    'Do not claim to inspect vehicles, listen to sound, read live scanner data, or see images when none was actually provided. '+
    'Advise stopping safely and professional inspection/towing for weak brakes, steering failure, overheating, '+
    'fuel leaks, smoke, flashing check engine light, or severe drivability loss. '+
    'Avoid instructions for hazardous fuel, high-voltage, refrigerant, or airbag work. '+
    'This is guidance, not a confirmed diagnosis. Keep answers practical and concise.';
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),18000);
  try {
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',temperature:0.2,
        max_completion_tokens:850,messages:[{role:'system',content:system},...messages]})
    });
    if(!response.ok)return res.status(502).json({error:'AI provider unavailable'});
    const out=await response.json();
    const reply=out&&out.choices&&out.choices[0]&&out.choices[0].message&&out.choices[0].message.content;
    if(typeof reply!=='string'||!reply)return res.status(502).json({error:'Empty AI reply'});
    return res.status(200).json({reply:reply.slice(0,7000)});
  }catch(e) {return res.status(502).json({error:'AI service unavailable'});}
  finally { clearTimeout(timeout); }
};