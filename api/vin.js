// Decode a VIN using the publicly available US NHTSA vPIC service.
// Does not persist submitted VINs or make claims about recalls.
const attempts=new Map();
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 const vin=String(req.query?.vin||'').trim().toUpperCase();
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))return res.status(400).json({error:'Enter a valid 17-character VIN using letters and numbers.'});
 const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,80),now=Date.now();
 const state=attempts.get(ip)||{since:now,count:0};if(now-state.since>60000){state.since=now;state.count=0;}state.count++;attempts.set(ip,state);
 if(state.count>8)return res.status(429).json({error:'Too many lookups. Please wait a minute.'});
 if(attempts.size>500)for(const [k,v] of attempts)if(now-v.since>60000)attempts.delete(k);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const r=await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/'+encodeURIComponent(vin)+'?format=json',{signal:controller.signal});
  if(!r.ok)return res.status(503).json({error:'Vehicle decoder is temporarily unavailable.'});
  const d=(await r.json())?.Results?.[0]||{};
  const year=Number(d.ModelYear);
  if(!d.Make||!d.Model||!Number.isInteger(year)||year<1981||year>new Date().getFullYear()+2)
   return res.status(422).json({error:'No reliable year, make and model could be determined. Enter them manually.'});
  const trim=[d.Trim,d.Series].filter(Boolean).join(' ').slice(0,80);
  const engine=[d.DisplacementL?d.DisplacementL+'L':'',d.EngineConfiguration||'',d.EngineCylinders?d.EngineCylinders+' cyl':''].filter(Boolean).join(' · ').slice(0,100);
  return res.status(200).json({year,make:String(d.Make).slice(0,50),model:String(d.Model).slice(0,70),trim,engine,
   warning:'VIN decoding identifies a vehicle configuration but does not verify installed components or current recalls.'});
 }catch(e){return res.status(503).json({error:'VIN lookup is temporarily unavailable. You can still enter the vehicle manually.'});}
 finally{clearTimeout(timer);}
};