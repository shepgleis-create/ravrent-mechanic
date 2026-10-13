const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const chatSource=fs.readFileSync(path.join(__dirname,'..','api/chat.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','vin-report.html'),'utf8');
const scanner=fs.readFileSync(path.join(__dirname,'..','vin-scanner.js'),'utf8');
const frameCode=fs.readFileSync(path.join(__dirname,'..','video-frames.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const Abort=class{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}};
function route(env,fetcher){
 const mod={exports:{}};
 return new Function('module','require','process','fetch','AbortController','setTimeout','clearTimeout','URL','console',
 chatSource+';return module.exports')(mod,require,{env},fetcher,Abort,()=>1,()=>{},URL,{warn(){},error(){}});
}
const response=()=>({code:200,data:null,setHeader(){},status(n){this.code=n;return this},json(v){this.data=v;return this}});
test('sampled vehicle video passes only two validated stills to vision model',async()=>{
 const captured=[];
 const handle=route({GROQ_API_KEY:'mock-key'},async(url,opts)=>{captured.push(JSON.parse(opts.body));return {ok:true,json:async()=>({choices:[{message:{content:'I can see two frames but cannot assess any noise.'}}]})}});
 const input={method:'POST',headers:{origin:'https://ravrent-mechanic.vercel.app',host:'ravrent-mechanic.vercel.app','x-forwarded-for':'198.51.100.233'},body:{messages:[{role:'user',text:'What do these images show?',video:{source:'sampled-frames',label:'vehicle.mp4',frames:[{atSeconds:1,image:'data:image/jpeg;base64,AA=='},{atSeconds:3,image:'data:image/jpeg;base64,AA=='}]}}]}};
 const out=response();await handle(input,out);
 assert.equal(out.code,200);assert.equal(out.data.provider,'Groq');
 const message=captured[0].messages.at(-1);
 assert.equal(message.content.filter(x=>x.type==='image_url').length,2);
 assert.ok(message.content.some(x=>x.type==='text'&&/do not convey continuous motion or audio/i.test(x.text)));
 assert.doesNotMatch(JSON.stringify(captured),/generativelanguage\.googleapis/);
});
test('more than two frames are rejected without spending an AI inference call',async()=>{
 let calls=0;
 const handle=route({GROQ_API_KEY:'mock-key'},async()=>{calls++;return {ok:true,json:async()=>({})}});
 const frames=Array.from({length:3},(_,i)=>({atSeconds:i,image:'data:image/jpeg;base64,AA=='}));
 const out=response();await handle({method:'POST',headers:{'x-forwarded-for':'198.51.100.234'},body:{messages:[{role:'user',text:'video',video:{source:'sampled-frames',frames}}]}},out);
 assert.equal(out.code,400);assert.equal(calls,0);
});
test('camera-first VIN lookup includes live controls and iPhone ZXing fallback',()=>{
 assert.doesNotThrow(()=>new vm.Script(scanner));
 assert.doesNotThrow(()=>new vm.Script(frameCode));
 assert.doesNotThrow(()=>new vm.Script(app));
 for(const id of ['scannerPanel','vinVideo','scanVin','captureVin','toggleTorch','flipCamera','autoReadVin','askVinAI'])assert.ok(html.includes('id="'+id+'"'),'Missing camera control '+id);
 assert.match(scanner,/getUserMedia/);
 assert.match(scanner,/BarcodeDetector/);
 assert.match(scanner,/@zxing\/library/);
 assert.match(scanner,/window\.addEventListener\('load',/);
 assert.match(scanner,/visibilitychange/);
});
test('Ravrent presents sampled video as no-audio, not fabricated full video interpretation',()=>{
 assert.match(app,/RavrentVideoFrames\.extract/);
 assert.match(app,/Audio is not analyzed/);
 assert.match(app,/Video still frames \(no audio\)/);
 assert.doesNotMatch(app,/Video with sound ·/);
});
