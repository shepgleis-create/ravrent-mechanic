// NHTSA five-star safety program. Ratings apply to tested variants, not VINs.
const hits=new Map();
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 const ip=String(req.headers?.['x-forwarded-for']||'unknown').split(',')[0].slice(0,80),now=Date.now(),rec=hits.get(ip)||{time:now,count:0};
 if(now-rec.time>60000){rec.time=now;rec.count=0}rec.count++;hits.set(ip,rec);
 if(rec.count>12)return res.status(429).json({error:'Try again in a minute'});
 if(hits.size>500)for(const [k,v] of hits)if(now-v.time>60000)hits.delete(k);
 let url='',mode='';
 if(req.query?.vehicleId!==undefined){
  const id=String(req.query.vehicleId);
  if(!/^[1-9][0-9]{0,9}$/.test(id))return res.status(400).json({error:'Invalid NHTSA vehicle identifier'});
  url='https://api.nhtsa.gov/SafetyRatings/VehicleId/'+id+'?format=json';mode='rating';
 }else{
  const year=Number(req.query?.year),make=String(req.query?.make||'').trim(),model=String(req.query?.model||'').trim();
  if(!Number.isInteger(year)||year<1981||year>new Date().getFullYear()+2||!/^[a-z0-9 .-]{2,60}$/i.test(make)||!/^[a-z0-9 .-]{1,80}$/i.test(model))return res.status(400).json({error:'Valid year, make and model required'});
  url='https://api.nhtsa.gov/SafetyRatings/modelyear/'+year+'/make/'+encodeURIComponent(make)+'/model/'+encodeURIComponent(model)+'?format=json';mode='variants';
 }
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),14000);
 try{
  const upstream=await fetch(url,{signal:c.signal,headers:{Accept:'application/json'}});
  if(!upstream.ok)return res.status(503).json({error:'NHTSA safety ratings unavailable'});
  const body=await upstream.json(),results=Array.isArray(body.Results)?body.Results:[];
  if(mode==='variants')return res.status(200).json({source:'NHTSA',scope:'Crash tests are available only for tested vehicle variants',variants:results.slice(0,30).map(v=>({id:Number(v.VehicleId),description:String(v.VehicleDescription||'Vehicle variant').slice(0,180)})).filter(v=>Number.isInteger(v.id)&&v.id>0)});
  const x=results[0];
  if(!x)return res.status(200).json({source:'NHTSA',rated:false});
  const safe=v=>String(v===null||v===undefined?'Not rated':v).slice(0,80);
  return res.status(200).json({source:'NHTSA',rated:true,vehicleDescription:safe(x.VehicleDescription),overall:safe(x.OverallRating),frontal:safe(x.OverallFrontCrashRating),side:safe(x.OverallSideCrashRating),rollover:safe(x.RolloverRating),investigatedModel:x.ModelYear?String(x.ModelYear).slice(0,4):null});
 }catch{return res.status(503).json({error:'Unable to retrieve NHTSA safety ratings'})}
 finally{clearTimeout(timer)}
};