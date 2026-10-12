const video=require('../lib/video');
const starts=new Map();
module.exports=async function handler(req,res){
 video.headers(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return video.response(res,405,'POST required','METHOD');}
 if(process.env.VIDEO_UPLOADS_ENABLED==='false')return video.response(res,503,'Video analysis is temporarily paused.','OWNER_PAUSED');
 if(!process.env.GEMINI_API_KEY)return video.response(res,503,'Video analysis is not configured on this deployment.','NOT_CONFIGURED');
 const origin=req.headers?.origin,host=req.headers?.host;
 if(origin&&host){try{if(new URL(origin).host!==host)return video.response(res,403,'Request not allowed.','ORIGIN');}
 catch{return video.response(res,403,'Invalid request origin.','ORIGIN');}}
 const data=req.body||{},length=Number(data.size),type=video.mime(data.mimeType);
 const name=String(data.name||'Vehicle video').replace(/[\x00-\x1f]/g,'').slice(0,90);
 if(!type||!Number.isSafeInteger(length)||length<1||length>video.LIMIT)
   return video.response(res,400,'Choose an MP4, MOV or WebM video no larger than 32 MB.','BAD_VIDEO');
 const now=Date.now(),ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,120);
 const row=starts.get(ip)||{since:now,count:0};if(now-row.since>3600000){row.since=now;row.count=0;}
 if(++row.count>4)return video.response(res,429,'Video upload limit reached. Try again later.','UPLOAD_LIMIT');
 starts.set(ip,row);
 if(starts.size>250){for(const [k,v] of starts)if(now-v.since>3600000)starts.delete(k);}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files',{
   method:'POST',signal:controller.signal,
   headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'X-Goog-Upload-Protocol':'resumable',
     'X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(length),
     'X-Goog-Upload-Header-Content-Type':type,'Content-Type':'application/json'},
   body:JSON.stringify({file:{display_name:name}})
  });
  if(!r.ok)return video.response(res,r.status===429?429:503,
    r.status===429?'Video upload capacity is currently limited. Try again later.':'Could not start this video upload.','UPLOAD_START_FAILED');
  const url=r.headers.get('x-goog-upload-url');
  if(!video.urlAllowed(url))return video.response(res,502,'Video upload service did not return a valid session.','UPLOAD_SESSION');
  // Respect the upload service's required chunk granularity. All non-final
  // chunks must be multiples of this value.
  const granularityRaw=r.headers.get('x-goog-upload-chunk-granularity');
  const granularity=granularityRaw?Number(granularityRaw):262144;
  if(!Number.isSafeInteger(granularity)||granularity<1||granularity>video.CHUNK)
    return video.response(res,503,'The video service requires an unsupported upload chunk size.','CHUNK_ALIGNMENT');
  const chunkSize=Math.floor(video.CHUNK/granularity)*granularity;
  if(chunkSize<granularity)return video.response(res,503,'Video upload chunk alignment failed.','CHUNK_ALIGNMENT');
  const token=video.pack({url,size:length,mime:type,created:Date.now()});
  return res.status(200).json({session:token,chunkSize,maxSize:video.LIMIT});
 }catch(e){return video.response(res,503,'Video upload service is unavailable. Please retry.','UPLOAD_NETWORK');}
 finally{clearTimeout(timer);}
};