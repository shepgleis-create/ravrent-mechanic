const video=require('./_video');
module.exports=async function handler(req,res){
 video.headers(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return video.response(res,405,'GET required','METHOD');}
 if(!process.env.GEMINI_API_KEY)return video.response(res,503,'Video processing is not configured.','NOT_CONFIGURED');
 const name=String(req.query?.name||'');
 if(!/^files\/[A-Za-z0-9_-]+$/.test(name))return video.response(res,400,'Invalid video reference.','BAD_REFERENCE');
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
 try{
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/'+name,{
    headers:{'x-goog-api-key':process.env.GEMINI_API_KEY},signal:ctl.signal
  });
  if(!r.ok)return video.response(res,r.status===404?404:503,'Video is unavailable or expired.','VIDEO_UNAVAILABLE');
  const data=await r.json();
  const state=data.state||'PROCESSING';
  return res.status(200).json({state,uri:typeof data.uri==='string'?data.uri:null,mimeType:video.mime(data.mimeType),name});
 }catch(e){return video.response(res,503,'Video processing status could not be checked.','VIDEO_STATUS');}
 finally{clearTimeout(timer);}
};