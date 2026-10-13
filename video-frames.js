// Extract representative still frames locally for open-weight vision models.
// No upload of the original video and NO audio analysis is claimed.
(function(root){'use strict';
const wait=(target,event,ms)=>new Promise((resolve,reject)=>{
 let timeout;
 const finish=(error)=>{clearTimeout(timeout);target.removeEventListener(event,ok);target.removeEventListener('error',bad);error?reject(error):resolve()};
 const ok=()=>finish(),bad=()=>finish(Error('Could not decode the video'));
 target.addEventListener(event,ok,{once:true});target.addEventListener('error',bad,{once:true});
 timeout=setTimeout(()=>finish(Error('The video did not finish loading')),ms)
});
async function extract(file,{count=2,maxDimension=600,quality=.6}={}){
 if(!file||!/^video\//.test(file.type)&&!/[.](?:mov|mp4|m4v|webm)$/i.test(file.name||''))throw Error('Choose a supported vehicle video');
 if(file.size>32*1024*1024)throw Error('Please select a video under 32 MB');
 count=Math.min(3,Math.max(1,Math.floor(Number(count)||2)));
 const url=URL.createObjectURL(file),video=document.createElement('video');
 video.preload='auto';video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');
 const cleanup=()=>{try{video.pause();video.removeAttribute('src');video.load()}catch{}URL.revokeObjectURL(url)};
 try{
  video.src=url;
  if(video.readyState<1)await wait(video,'loadedmetadata',12000);
  const duration=Number(video.duration),width=video.videoWidth,height=video.videoHeight;
  if(!Number.isFinite(duration)||duration<=0||duration>90)throw Error('Select a video up to 90 seconds with readable metadata');
  if(!width||!height)throw Error('Video frames are not available in this browser');
  const scale=Math.min(1,Math.max(160,Math.min(1000,maxDimension))/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Cannot access video frame capture');
  const frames=[];
  const fractions=count===1?[.5]:count===2?[.22,.78]:[.15,.5,.85];
  for(const fraction of fractions){
   const time=Math.min(duration-0.05,Math.max(0,duration*fraction));
   if(Math.abs(video.currentTime-time)>.04){
    video.currentTime=time;
    await wait(video,'seeked',9000)
   }
   ctx.drawImage(video,0,0,canvas.width,canvas.height);
   const image=canvas.toDataURL('image/jpeg',Math.min(.8,Math.max(.4,quality)));
   if(image.length>650000)throw Error('Video frame is too large; try a lower-resolution recording');
   frames.push({atSeconds:Math.round(time*10)/10,image})
  }
  return {frames,duration:Math.round(duration*10)/10,width:canvas.width,height:canvas.height,
    note:'Sampled still frames only. The AI cannot hear audio or see motion between sampled frames.'}
 }finally{cleanup()}
}
const api={extract};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.RavrentVideoFrames=api;
})(typeof window!=='undefined'?window:null);
