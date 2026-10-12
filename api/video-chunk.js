const video=require('../lib/video');

// Proxy chunks to the same Google resumable upload session. When the network
// rejects/redirects a chunk, query the server's accepted byte offset instead
// of assuming the entire video failed. Avoid leaking the session URL or key.
async function queryPosition(session,signal){
  const r=await fetch(session.url,{
    method:'POST',redirect:'manual',signal,
    headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,
      'X-Goog-Upload-Command':'query',
      'Content-Length':'0'},
    body:Buffer.alloc(0)
  });
  if(r.status!==200&&r.status!==308) return null;
  const got=r.headers.get('x-goog-upload-size-received');
  const state=r.headers.get('x-goog-upload-status')||'active';
  if(!/^\d+$/.test(String(got||'')))return null;
  return {received:Number(got),state};
}
module.exports=async function handler(req,res){
 video.headers(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return video.response(res,405,'POST required','METHOD');}
 if(!process.env.GEMINI_API_KEY)return video.response(res,503,'Video transfer is not configured.','NOT_CONFIGURED');
 const origin=req.headers?.origin,host=req.headers?.host;
 if(origin&&host){try{if(new URL(origin).host!==host)return video.response(res,403,'Request not allowed.','ORIGIN');}
 catch{return video.response(res,403,'Invalid request.','ORIGIN');}}
 let session;
 try{session=video.unpack(req.headers?.['x-upload-session']);}
 catch{return video.response(res,401,'Video upload session expired. Attach the video again.','BAD_SESSION');}
 const value=String(req.headers?.['x-upload-offset']||'');
 if(!/^(0|[1-9][0-9]{0,9})$/.test(value))return video.response(res,400,'Invalid video offset.','OFFSET');
 const offset=Number(value);
 let bytes;try{bytes=await video.readBytes(req);}
 catch(e){console.warn('VIDEO_CHUNK_BODY',{error:e?.message||'BODY_ERROR'});return video.response(res,413,'Video chunk could not be read.','CHUNK_BODY');}
 if(!bytes.length||bytes.length>video.CHUNK||offset<0||offset+bytes.length>session.size)
   return video.response(res,400,'Invalid video chunk size or offset.','CHUNK_RANGE');
 const expected=offset+bytes.length,final=expected===session.size;
 if((req.headers?.['x-upload-final']==='1')!==final)
   return video.response(res,400,'Upload completion mismatch.','FINAL_FLAG');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),24000);
 try{
  // Google expects POST with upload/finalize and a byte offset. Explicitly
  // disable automatic redirects: HTTP 308 may mean resumable progress, not a
  // URL to follow with the binary request.
  const response=await fetch(session.url,{
    method:'POST',redirect:'manual',signal:controller.signal,
    headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,
      'X-Goog-Upload-Offset':String(offset),
      'X-Goog-Upload-Command':final?'upload, finalize':'upload',
      'Content-Length':String(bytes.length),
      'Content-Type':'application/octet-stream'},
    body:bytes
  });
  if(response.ok){
    if(!final)return res.status(200).json({received:expected,complete:false});
    const out=await response.json().catch(()=>({})),file=out.file||{};
    if(!/^files\/[A-Za-z0-9_-]+$/.test(file.name||'')||typeof file.uri!=='string')
      return video.response(res,502,'Video uploaded, but no usable file reference was returned.','UPLOAD_FINAL');
    return res.status(200).json({complete:true,received:expected,file:{
      name:file.name,uri:file.uri,mimeType:session.mime,state:file.state||'PROCESSING'}});
  }
  // A 308, 5xx, 429 or interrupted transfer may still have accepted the
  // bytes. Ask Google how far it got. The frontend resumes from that offset.
  let position=null;
  try{position=await queryPosition(session,controller.signal);}catch(e){}
  if(position&&Number.isSafeInteger(position.received)&&position.received>=0&&position.received<=session.size){
    if(position.received===expected&&!final)
      return res.status(200).json({received:expected,complete:false,recovered:true});
    if(position.received!==offset)
      return res.status(409).json({code:'RESUME_AT_OFFSET',received:position.received,
        error:'Video transfer paused. Resuming from the last accepted byte.'});
  }
  console.warn('VIDEO_CHUNK_UPSTREAM',{status:response.status,offset,chunkSize:bytes.length,final});
  return res.status(response.status===429?429:502).json({
    code:response.status===429?'UPLOAD_QUOTA':'UPLOAD_CHUNK_REJECTED',
    upstreamStatus:response.status,
    error:response.status===429?'Video uploads are temporarily rate-limited. Try again later.':
      'Video upload service rejected this chunk (HTTP '+response.status+'). Retry the transfer.'
  });
 }catch(e){
  if(!controller.signal.aborted){
    try{
      const position=await queryPosition(session,controller.signal);
      if(position&&position.received===expected&&!final)
        return res.status(200).json({received:expected,complete:false,recovered:true});
      if(position&&position.received!==offset)
        return res.status(409).json({code:'RESUME_AT_OFFSET',received:position.received,
          error:'Connection interrupted. Resuming video at the last confirmed position.'});
    }catch(x){}
  }
  console.warn('VIDEO_CHUNK_NETWORK',{offset,bytes:bytes.length,timeout:controller.signal.aborted,error:e?.name||'NETWORK'});
  return video.response(res,503,controller.signal.aborted?
    'Video transfer timed out. Try again on a stable connection.':
    'Network error while transferring this video. The app can retry.','TRANSFER_NETWORK');
 }finally{clearTimeout(timer);}
};