// User-triggered, non-generating Gemini configuration check.
// A successful models-list request validates basic key/project access, NOT inference quota or billing.
const {classifyGoogleError}=require('./google-error');
const attempts=new Map();
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required',code:'METHOD'})}
 const key=String(process.env.GEMINI_API_KEY||'').trim();
 if(process.env.AI_REQUESTS_ENABLED==='false')return res.status(200).json({status:'paused',code:'OWNER_PAUSED',message:'AI has been paused by the project owner.'});
 if(!key)return res.status(200).json({status:'not_configured',code:'MISSING_KEY',message:'The Google AI API key is missing from the server.'});
 const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,80);
 const now=Date.now(),counter=attempts.get(ip)||{since:now,count:0};
 if(now-counter.since>60000){counter.since=now;counter.count=0}
 counter.count++;attempts.set(ip,counter);
 if(attempts.size>400)for(const [k,v] of attempts)if(now-v.since>60000)attempts.delete(k);
 if(counter.count>5)return res.status(429).json({status:'rate_limited',code:'LOCAL_LIMIT',message:'Wait a minute before checking again.'});
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),9000);
 const standard=process.env.GEMINI_STANDARD_MODEL||'gemini-2.5-flash-lite';
 const deep=process.env.GEMINI_MODEL||'gemini-2.5-flash';
 try{
  const upstream=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{
   signal:c.signal,headers:{'x-goog-api-key':key,Accept:'application/json'}
  });
  if(!upstream.ok){
   let errorBody={};try{errorBody=await upstream.json()}catch{}
   const issue=classifyGoogleError(upstream.status,errorBody);
   return res.status(200).json({status:'failed',code:issue.code,message:issue.action,providerStatus:issue.providerStatus})
  }
  const body=await upstream.json();if(!Array.isArray(body.models))throw Error('INVALID_PROVIDER_RESPONSE');
  const supported=new Set(body.models.filter(x=>Array.isArray(x.supportedGenerationMethods)&&x.supportedGenerationMethods.includes('generateContent')).map(x=>String(x.name||'').replace(/^models\//,'')));
  return res.status(200).json({
   status:'provider_access_ok',
   code:'MODEL_LIST_PASSED',
   standardModel:standard,
   standardModelListed:supported.has(standard),
   deepModel:deep,
   deepModelListed:supported.has(deep),
   note:'Google accepted the server key for model listing. A live generateContent response is still required to verify chat, quota and billing.'
  })
 }catch(e){return res.status(200).json({status:'unknown',code:c.signal.aborted?'TIMEOUT':'PROVIDER_NETWORK',message:c.signal.aborted?'The Google model-list check timed out.':'Could not complete the Google model-list check.'})}
 finally{clearTimeout(timer)}
};