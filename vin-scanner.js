// Live camera-first VIN scanning. Barcode recognition and local OCR never require paid AI.
(()=>{'use strict';
const $=id=>document.getElementById(id);
const status=message=>{const area=$('scanStatus');if(area)area.textContent=message};
const hint=message=>{const area=$('scanHint');if(area)area.textContent=message};
const badge=message=>{const area=$('cameraBadge');if(area)area.textContent=message};
const vinPattern=/^[A-HJ-NPR-Z0-9]{17}$/;
const weights=[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
const table={A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9};
let stream=null,scanTimer=null,autoTimer=null,detector=null,scanning=false,reading=false,starting=false;
let facing='environment',torch=false,ocrWorker=null,ocrPromise=null,libraryPromise=null;
let autoReopen=false;
function checksum(vin){
 if(!vinPattern.test(vin))return false;
 let sum=0;for(let i=0;i<17;i++){const val=/^[0-9]$/.test(vin[i])?Number(vin[i]):table[vin[i]];if(val===undefined)return false;sum+=val*weights[i]}
 return vin[8]===(sum%11===10?'X':String(sum%11))
}
function candidates(text){
 const raw=String(text||'').toUpperCase().replace(/\|/g,'1'),seen=new Set();
 for(const segment of [...raw.split(/[\n\r]+/),raw.replace(/\s+/g,'')]){
  for(const match of segment.match(/[A-HJ-NPR-Z0-9]{17}/g)||[])if(vinPattern.test(match))seen.add(match)
 }
 return [...seen].sort((a,b)=>Number(checksum(b))-Number(checksum(a)))
}
function stopCamera({reason='stopped'}={}){
 if(scanTimer){clearInterval(scanTimer);scanTimer=null}
 if(autoTimer){clearInterval(autoTimer);autoTimer=null}
 if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}
 const video=$('vinVideo');if(video){video.pause();video.srcObject=null}
 detector=null;scanning=false;starting=false;torch=false;
 $('toggleTorch').disabled=true;$('toggleTorch').setAttribute('aria-pressed','false');
 $('scanVin').textContent='Start camera';badge('CAMERA IDLE');
 if(reason==='stopped')hint('Camera stopped. Tap Start camera to scan another vehicle.');
}
function accept(vin,source,automatic=false){
 if(!vinPattern.test(vin))return false;
 if(automatic&&!checksum(vin))return false;
 $('vin').value=vin;
 if(checksum(vin)){
  stopCamera({reason:'completed'});
  status('VIN read from '+source+': '+vin+'. Verify it matches the vehicle.');
  hint('VIN detected. Confirm the decoded vehicle details below.');
  $('decode').click()
 }else{
  status('Possible VIN '+vin+' read from '+source+'. Verify every character and tap Decode VIN manually; checksum did not validate.')
 }
 return true
}
async function loadOCR(){
 if(window.Tesseract)return window.Tesseract;
 if(!libraryPromise){
  libraryPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.async=true;
   script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
   script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR not initialized'));
   script.onerror=()=>reject(Error('OCR library unavailable'));
   document.head.append(script)
  }).catch(e=>{libraryPromise=null;throw e})
 }
 return libraryPromise
}
async function recognize(image,source,{automatic=false}={}){
 if(reading)return;
 reading=true;if(!automatic)status('Reading VIN text from '+source+'…');
 try{
  const library=await loadOCR();
  if(!ocrWorker){
   if(!ocrPromise)ocrPromise=library.createWorker('eng').catch(e=>{ocrPromise=null;throw e});
   ocrWorker=await ocrPromise
  }
  const result=await ocrWorker.recognize(image);
  const possible=candidates(result?.data?.text);
  const selected=possible.find(checksum)||(!automatic?possible[0]:null);
  if(selected){accept(selected,source,automatic)}
  else if(!automatic)status('No complete VIN was found. Move closer, improve lighting or use the photo button.')
 }catch{
  if(!automatic)status('VIN text reader could not load. Use barcode scan, camera photo or manual entry.')
 }finally{reading=false}
}
async function captureFrame({automatic=false}={}){
 const video=$('vinVideo');
 if(!stream||video.readyState<2||!video.videoWidth){if(!automatic)status('Camera is not ready yet.');return}
 const scale=Math.min(1,1000/video.videoWidth),width=Math.round(video.videoWidth*scale),height=Math.round(video.videoHeight*scale);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx){if(!automatic)status('This browser cannot read camera frames.');return}
 ctx.drawImage(video,0,0,width,height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
 if(blob)await recognize(blob,automatic?'live camera':'camera frame',{automatic})
}
async function barcodeScan(){
 if(!stream||!detector||scanning||reading||$('vinVideo').readyState<2)return;
 scanning=true;
 try{
  const records=await detector.detect($('vinVideo'));
  for(const record of records){const possible=candidates(record.rawValue);
   const selected=possible.find(checksum)||possible[0];
   if(selected&&accept(selected,'barcode'))break
  }
 }catch{}finally{scanning=false}
}
async function startCamera({autostart=false}={}){
 if(stream||starting)return;
 if(!navigator.mediaDevices?.getUserMedia){
  badge('CAMERA NOT AVAILABLE');hint('This browser cannot open a live camera. Use a photo or open Ravrent in Safari.');return
 }
 starting=true;badge('OPENING CAMERA');hint('Allow rear camera access when the browser asks.');
 try{
  const active=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}}});
  stream=active;const video=$('vinVideo');
  video.srcObject=active;video.muted=true;video.playsInline=true;
  try{await video.play()}catch{throw Error('Playback prevented')}
  $('scannerPanel').hidden=false;$('scanVin').textContent='Camera running';
  badge('LIVE');hint('Align the VIN barcode or printed text inside the guide. Barcode recognition starts automatically.');
  status('Live camera active. Tap Read VIN text for printed VINs; barcode scanning runs automatically.');
  const track=active.getVideoTracks()[0],cap=track?.getCapabilities?.()||{};
  $('toggleTorch').disabled=!cap.torch;
  if(typeof window.BarcodeDetector!=='undefined'){
   try{
    const supported=await window.BarcodeDetector.getSupportedFormats();
    const formats=['code_39','code_128','pdf417','data_matrix'].filter(f=>supported.includes(f));
    if(formats.length){detector=new window.BarcodeDetector({formats});scanTimer=setInterval(barcodeScan,550)}
   }catch{}
  }
  if($('autoReadVin').checked)autoTimer=setInterval(()=>captureFrame({automatic:true}),5000);
 }catch{
  stopCamera({reason:'permission'});
  badge('PERMISSION NEEDED');
  hint(autostart?'Tap Start camera to grant camera access. Safari or Chrome may require a tap.':'Unable to start. Enable camera access in browser settings or use Take VIN photo.');
 }finally{starting=false}
}
$('scanVin').addEventListener('click',()=>{if(stream){status('Camera is already running. Point it at the VIN.');return}startCamera()});
$('stopScan').addEventListener('click',()=>stopCamera());
$('captureVin').addEventListener('click',()=>captureFrame());
$('flipCamera').addEventListener('click',async()=>{facing=facing==='environment'?'user':'environment';stopCamera({reason:'switch'});await startCamera()});
$('toggleTorch').addEventListener('click',async()=>{
 const track=stream?.getVideoTracks?.()[0];if(!track)return;
 try{torch=!torch;await track.applyConstraints({advanced:[{torch}]});$('toggleTorch').setAttribute('aria-pressed',String(torch));$('toggleTorch').textContent=torch?'Flashlight on':'Flashlight'}
 catch{torch=false;status('Flashlight control is not supported by this camera.')}
});
$('autoReadVin').addEventListener('change',e=>{
 if(autoTimer){clearInterval(autoTimer);autoTimer=null}
 if(stream&&e.target.checked)autoTimer=setInterval(()=>captureFrame({automatic:true}),5000);
 status(e.target.checked?'Auto-read enabled; camera text OCR will run about every five seconds.':'Auto-read stopped; barcode scanning remains active.')
});
$('vinPhoto').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';
 if(!file)return;
 if(!/^image\//.test(file.type)||file.size>15*1024*1024){status('Select an image under 15 MB.');return}
 await recognize(file,'VIN photo')
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){autoReopen=Boolean(stream);stopCamera({reason:'background'})}else if(autoReopen){autoReopen=false;hint('Tap Start camera to resume scanning after returning to the app.')}});
window.addEventListener('pagehide',()=>{stopCamera({reason:'background'});if(ocrWorker){ocrWorker.terminate().catch(()=>{});ocrWorker=null}});
window.addEventListener('load',()=>{startCamera({autostart:true})});
})();