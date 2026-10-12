const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const video = require('../lib/video');
const chunk = require('../api/video-chunk');
const start = require('../api/video-start');

process.env.GEMINI_API_KEY = 'fake-test-key-NO-REAL-CREDENTIALS';

function makeRes() {
  return {
    code: 200, body: null, headers: {},
    setHeader(k,v){this.headers[k]=v;},
    status(n){this.code=n;return this;},
    json(data){this.body=data;return this;}
  };
}
function mockReply(status,headers={},payload={}) {
  return {status,ok:status>=200&&status<300,headers:{get(key){return headers[String(key).toLowerCase()]||null;}},
    json:async()=>payload};
}
function session(length=12){
  return video.pack({url:'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=unit-test',
    size:length,mime:'video/mp4',created:Date.now()});
}
function chunkReq(token) {
  return {method:'POST',body:Buffer.from([0,1,2,3,4]),headers:{
    'host':'ravrent-mechanic.vercel.app','origin':'https://ravrent-mechanic.vercel.app',
    'x-upload-session':token,'x-upload-offset':'0','x-upload-final':'0'}};
}
async function withFetch(sequence,fn){
  const old=global.fetch,received=[];
  global.fetch=async (url,options)=>{
    received.push({url,options});
    const result=sequence[received.length-1];
    if(!result)throw new Error('Unexpected network call');
    return result;
  };
  try{await fn(received);}finally{global.fetch=old;}
}

test('successful first chunk uses explicit content length and no redirect',async()=>{
  await withFetch([mockReply(200)],async calls=>{
    const res=makeRes();await chunk(chunkReq(session()),res);
    assert.equal(res.code,200);assert.equal(res.body.received,5);
    assert.equal(calls[0].options.redirect,'manual');
    assert.equal(calls[0].options.headers['Content-Length'],'5');
    assert.equal(calls[0].options.headers['X-Goog-Upload-Command'],'upload');
  });
});

test('HTTP 308 triggers server offset query and recovers acknowledged bytes',async()=>{
  await withFetch([mockReply(308),mockReply(200,{'x-goog-upload-size-received':'5','x-goog-upload-status':'active'})],async calls=>{
    const res=makeRes();await chunk(chunkReq(session()),res);
    assert.equal(res.code,200);assert.equal(res.body.received,5);
    assert.equal(res.body.recovered,true);
    assert.equal(calls[1].options.headers['X-Goog-Upload-Command'],'query');
  });
});

test('temporary upstream error with acknowledged bytes does not lose progress',async()=>{
  await withFetch([mockReply(503),mockReply(200,{'x-goog-upload-size-received':'5'})],async()=>{
    const res=makeRes();await chunk(chunkReq(session()),res);
    assert.equal(res.code,200);assert.equal(res.body.recovered,true);
  });
});

test('upstream rejection includes status and machine-readable error code',async()=>{
  await withFetch([mockReply(400),mockReply(200,{'x-goog-upload-size-received':'0'})],async()=>{
    const res=makeRes();await chunk(chunkReq(session()),res);
    assert.equal(res.code,502);
    assert.equal(res.body.code,'UPLOAD_CHUNK_REJECTED');
    assert.equal(res.body.upstreamStatus,400);
    assert.doesNotMatch(JSON.stringify(res.body),/fake-test-key/);
  });
});

test('upload start honors required chunk alignment',async()=>{
  const headers={'x-goog-upload-url':'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=unit-test',
    'x-goog-upload-chunk-granularity':'262144'};
  const old=global.fetch;global.fetch=async()=>mockReply(200,headers);
  try{
    const res=makeRes();
    await start({method:'POST',body:{size:2000000,mimeType:'video/mp4',name:'engine.mp4'},
      headers:{origin:'https://ravrent-mechanic.vercel.app',host:'ravrent-mechanic.vercel.app','x-forwarded-for':'test-case'}},res);
    assert.equal(res.code,200);
    assert.equal(res.body.chunkSize%262144,0);
    assert.ok(res.body.session.length>70);
  }finally{global.fetch=old;}
});

test('frontend syntax is valid',()=>{
  const frontend=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
  assert.doesNotThrow(()=>new Function(frontend));
});
