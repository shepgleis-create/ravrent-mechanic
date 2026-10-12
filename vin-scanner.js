// Browser-only camera, barcode and photo OCR VIN capture. No navigation away from the app.
(()=>{'use strict';
const $=id=>document.getElementById(id);
const say=message=>{$('scanStatus').textContent=message};
const vinPattern=/^[A-HJ-NPR-Z0-9]{17}$/;
const weights=[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
const transliteration='0123456789.ABCDEFGH..JKLMN.P.R..STUVWXYZ';
let stream=null,scanInterval=null,detector=null,scanning=false,reading=false,loadPromise=null;
function checksum(vin){
 if(!vinPattern.test(vin))return false;
 const table={A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9};
 let total=0;
 for(let i=0;i<17;i++){const c=vin[i],value=/^[0-9]$/.test(c)?Number(c):table[c];if(value===undefined)return false;total+=value*weights[i]}
 const digit=total%11===10?'X':String(total%11);
 return vin[8]===digit
}
function candidates(text){
 const raw=String(text||'').toUpperCase().replace(/[|]/g,'1');
 const pieces=[...raw.split(/[\n\r]+/),raw.replace(/\s+/g,'')];
 const found=[];
 for(const piece of pieces){
  const matches=piece.match(/[A-HJ-NPR-Z0-9]{17}/g)||[];
  for(const v of matches)if(vinPattern.test(v)&&!found.includes(v))found.push(v)
 }
 return found.sort((a,b)=>Number(checksum(b))-Number(checksum(a)))
}
function accept(vin,source){
 if(!vinPattern.test(vin))return false;
 $('vin').value=vin;
 stopCamera();
 if(checksum(vin)){
  say('VIN read from '+source+': '+vin+'. Check it matches the vehicle before using the report.');
  $('decode').click();
 }else{
  say('Possible VIN read from '+source+': '+vin+'. Check every character and tap Decode VIN; check digit did not validate.');
 }
 return true
}
function stopCamera(){
 if(scanInterval){clearInterval(scanInterval);scanInterval=null}
 if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}
 const video=$('vinVideo');if(video)video.srcObject=null;
 $('scannerPanel').hidden=true;detector=null;scanning=false
}
async function loadOCR(){
 if(window.Tesseract)return;
 if(loadPromise)return loadPromise;
 loadPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  script.async=true;script.onload=()=>window.Tesseract?resolve():reject(Error('OCR is unavailable'));
  script.onerror=()=>reject(Error('OCR library could not load'));
  document.head.append(script)
 });
 try{await loadPromise}catch(e){loadPromise=null;throw e}
}
async function recognize(image,source){
 if(reading){say('Already reading a photo. Please wait.');return}
 reading=true;say('Reading the VIN from '+source+'. This may take a moment…');
 try{
  await loadOCR();
  const result=await Tesseract.recognize(image,'eng');
  const found=candidates(result?.data?.text);
  if(found.length){accept(found[0],source)}
  else{say('No complete 17-character VIN found. Try a closer, sharper photo in good lighting, or enter it manually.')}
 }catch{say('Could not read this image. Check connection and try another photo, or enter the VIN manually.')}
 finally{reading=false}
}
async function readVideoFrame(){
 const video=$('vinVideo');
 if(!stream||video.readyState<2){say('Camera is not ready yet.');return}
 const width=video.videoWidth,height=video.videoHeight;
 if(!width||!height){say('No camera frame yet.');return}
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');
 if(!context){say('Camera capture is not supported. Use Take VIN photo.');return}
 context.drawImage(video,0,0,width,height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
 if(!blob){say('Unable to capture camera frame.');return}
 stopCamera();
 await recognize(blob,'camera image')
}
async function scanLive(){
 if(!stream||!detector||scanning||reading||$('vinVideo').readyState<2)return;
 scanning=true;
 try{
  const records=await detector.detect($('vinVideo'));
  for(const record of records){
   const result=candidates(record.rawValue);
   if(result.length&&accept(result[0],'barcode'))break
  }
 }catch{}finally{scanning=false}
}
$('captureVin').addEventListener('click',()=>{readVideoFrame()});
$('stopScan').addEventListener('click',()=>{stopCamera();say('Camera closed.')});
$('scanVin').addEventListener('click',async()=>{
 if(stream){stopCamera();say('Camera closed.');return}
 if(!navigator.mediaDevices?.getUserMedia){say('Live camera access is unavailable here. Tap Take VIN photo instead.');return}
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
  const video=$('vinVideo');video.srcObject=stream;$('scannerPanel').hidden=false;
  await video.play();
  say('Point the camera at the VIN and tap Read VIN from camera image.');
  if(typeof BarcodeDetector!=='undefined'){
   try{
    const supported=await BarcodeDetector.getSupportedFormats();
    const formats=['code_39','code_128','pdf417','data_matrix'].filter(f=>supported.includes(f));
    if(formats.length){detector=new BarcodeDetector({formats});scanInterval=setInterval(scanLive,500);
     say('Scanning VIN barcode automatically. For printed VIN text, tap Read VIN from camera image.')}
   }catch{}
  }
 }catch{
  stopCamera();say('Could not open camera. Allow camera access, or use Take VIN photo.')
 }
});
$('vinPhoto').addEventListener('change',async event=>{
 const photo=event.target.files?.[0];event.target.value='';
 if(!photo)return;
 if(!photo.type.startsWith('image/')){say('Choose a photo of a VIN.');return}
 if(photo.size>15*1024*1024){say('Photo is too large. Use an image under 15 MB.');return}
 stopCamera();await recognize(photo,'photo')
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera()});
window.addEventListener('pagehide',stopCamera);
})();