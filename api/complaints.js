// Public NHTSA model-level owner complaints, not individual vehicle history.
const attempts=new Map();
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'GET required'});
 const year=Number(req.query?.year),make=String(req.query?.make||'').trim(),model=String(req.query?.model||'').trim();
 if(!Number.isInteger(year)||year<1981||year>new Date().getFullYear()+2||!/^[a-z0-9 .-]{2,60}$/i.test(make)||!/^[a-z0-9 .-]{1,80}$/i.test(model))return res.status(400).json({error:'Valid year, make and model required'});
 const ip=String(req.headers?.['x-forwarded-for']||'unknown').split(',')[0].slice(0,80),now=Date.now(),p=attempts.get(ip)||{time:now,count:0};
 if(now-p.time>60000){p.time=now;p.count=0}p.count++;attempts.set(ip,p);
 if(p.count>12)return res.status(429).json({error:'Please wait before trying again'});
 if(attempts.size>500)for(const [k,v] of attempts)if(now-v.time>60000)attempts.delete(k);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),14000);
 try{
  const url='https://api.nhtsa.gov/complaints/complaintsByVehicle?make='+encodeURIComponent(make)+'&model='+encodeURIComponent(model)+'&modelYear='+year;
  const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
  if(!response.ok)return res.status(503).json({error:'NHTSA complaints data is currently unavailable'});
  const body=await response.json();if(!Array.isArray(body.results))throw Error('Unexpected NHTSA data');
  const complaints=body.results.slice(0,40).map(x=>({
   id:String(x.odiNumber||'').slice(0,30),
   components:(Array.isArray(x.components)?x.components:[x.components]).filter(Boolean).map(v=>String(v).slice(0,140)).slice(0,6),
   summary:String(x.summary||'').slice(0,1700),
   incidentDate:String(x.dateOfIncident||'').slice(0,35),
   crash:x.crash===true||x.crash==='Y',fire:x.fire===true||x.fire==='Y'
  }));
  return res.status(200).json({source:'NHTSA',scope:'Unverified consumer complaints for this year, make and model, not this VIN',count:Number.isInteger(body.count)?body.count:Number.isInteger(body.Count)?body.Count:body.results.length,sampleCount:complaints.length,complaints});
 }catch{return res.status(503).json({error:'Unable to load NHTSA complaints right now'})}
 finally{clearTimeout(timeout)}
};