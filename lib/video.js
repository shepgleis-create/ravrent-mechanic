// Internal support for bounded video uploads. Keep signing key on server.
const crypto=require('node:crypto');
const LIMIT=32*1024*1024;
const CHUNK=1024*1024;
const TTL=25*60*1000;
const VIDEO_MIMES=new Set(['video/mp4','video/mov','video/webm','video/mpeg','video/3gpp']);
function mime(input){
 const v=String(input||'').toLowerCase().split(';')[0].trim();
 return v==='video/quicktime'?'video/mov':v==='video/x-m4v'?'video/mp4':VIDEO_MIMES.has(v)?v:null;
}
function signingKey(){
 if(!process.env.GEMINI_API_KEY)throw Error('CONFIG');
 return crypto.createHash('sha256').update('ravrent-video-session:v1:'+process.env.GEMINI_API_KEY).digest();
}
function pack(data){
 const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',signingKey(),nonce);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
 return [nonce.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
function urlAllowed(url){
 try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='generativelanguage.googleapis.com'&&
  u.pathname.startsWith('/upload/v1beta/files')&&u.username===''&&u.password==='';}
 catch{return false;}
}
function unpack(token){
 if(typeof token!=='string'||token.length>4500||token.length<50)throw Error('SESSION');
 const p=token.split('.');if(p.length!==3)throw Error('SESSION');
 try{
  const decipher=crypto.createDecipheriv('aes-256-gcm',signingKey(),Buffer.from(p[0],'base64url'));
  decipher.setAuthTag(Buffer.from(p[1],'base64url'));
  const data=JSON.parse(Buffer.concat([decipher.update(Buffer.from(p[2],'base64url')),decipher.final()]).toString('utf8'));
  if(!data||Date.now()-data.created>TTL||data.created>Date.now()+15000||
    !urlAllowed(data.url)||!mime(data.mime)||!Number.isSafeInteger(data.size)||data.size<1||data.size>LIMIT)throw Error('SESSION');
  return data;
 }catch{throw Error('SESSION');}
}
function headers(res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
}
function response(res,code,message,slug){return res.status(code).json({error:message,code:slug||'VIDEO_ERROR'});}
async function readBytes(req){
 // Hosting runtimes may expose binary octet-stream bodies as Buffers, typed
 // arrays, ArrayBuffers, JSON-serialized buffers, or the raw request stream.
 const body=req.body;
 let binary=null;
 if(Buffer.isBuffer(body))binary=body;
 else if(body instanceof ArrayBuffer)binary=Buffer.from(body);
 else if(ArrayBuffer.isView(body))binary=Buffer.from(body.buffer,body.byteOffset,body.byteLength);
 else if(body&&typeof body==='object'&&body.type==='Buffer'&&Array.isArray(body.data))
   binary=Buffer.from(body.data);
 else if(typeof body==='string')binary=Buffer.from(body,'latin1');
 if(binary!==null){
   if(binary.length>CHUNK)throw Error('TOO_LARGE');
   return binary;
 }
 let size=0,parts=[];
 for await(const b of req){const p=Buffer.isBuffer(b)?b:Buffer.from(b);size+=p.length;
   if(size>CHUNK)throw Error('TOO_LARGE');parts.push(p);}
 return Buffer.concat(parts);
}
module.exports={LIMIT,CHUNK,mime,pack,unpack,urlAllowed,headers,response,readBytes};
