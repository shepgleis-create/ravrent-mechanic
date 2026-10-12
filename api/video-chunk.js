const video=require('./_video');
module.exports=async function handler(req,res){
 video.headers(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return video.response(res,405,'POST required','METHOD');}
 let session;
 try{session=video.unpack(req.headers['x-upload-session']);}
 catch{return video.response(res,401,'Upload session expired or invalid. Select the video again.','BAD_SESSION');}
 const value=String(req.headers['x-upload-offset']||'');
 if(!/^(0|[1-9][0-9]{0,9})$/.test(value))return video.response(res,400,'Invalid video offset.','OFFSET');
 const offset=Number(value);
 let bytes;try{bytes=await video.readBytes(req);}catch{return video.response(res,413,'Video chunk too large.','CHUNK_SIZE');}
 if(!bytes.length||bytes.length>video.CHUNK||offset<0||offset+bytes.length>session.size)
  return video.response(res,400,'Invalid chunk size or offset.','CHUNK_RANGE');
 const final=offset+bytes.length===session.size;
 if((req.headers['x-upload-final']==='1')!==final)return video.response(res,400,'Upload completion flag does not match file size.','FINAL_FLAG');
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),26000);
 try{
  const r=await fetch(session.url,{
   method:'POST',signal:ctl.signal,headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,
     'X-Goog-Upload-Offset':String(offset),
     'X-Goog-Upload-Command':final?'upload, finalize':'upload',
     'Content-Type':'application/octet-stream'},
   body:bytes
  });
  if(!r.ok)return video.response(res,r.status===429?429:502,'Video transfer interrupted. Please select the video and try again.','CHUNK_FAILED');
  if(!final)return res.status(200).json({received:offset+bytes.length,complete:false});
  let file={};try{file=(await r.json()).file||{};}catch{}
  if(!/^files\/[A-Za-z0-9_-]+$/.test(file.name||'')||typeof file.uri!=='string')
   return video.response(res,502,'Video completed but returned no usable file reference.','UPLOAD_FINAL');
  return res.status(200).json({complete:true,file:{name:file.name,uri:file.uri,mimeType:session.mime,state:file.state||'PROCESSING'}});
 }catch(e){return video.response(res,503,'Video transfer failed. Please retry the upload.','TRANSFER_NETWORK');}
 finally{clearTimeout(timer);}
};