(()=>{'use strict';
// AdSense script and units load only after server confirms approval and privacy readiness.
// No ads in chat, garage, VIN, inspection, or other diagnostic forms.
const areas=[...document.querySelectorAll('[data-ravrent-ad]')];
if(!areas.length)return;
const optedOut=()=>{try{return localStorage.getItem('ravrent_ads_disabled')==='true'}catch{return false}};
if(navigator.globalPrivacyControl===true||optedOut())return;
const status=document.getElementById('advertisingStatus');
const writeStatus=s=>{if(status)status.textContent=s};
function renderArea(area,publisher,slot){
 area.replaceChildren();
 const label=document.createElement('div');label.className='ad-label';label.textContent='Advertisement';area.append(label);
 const ins=document.createElement('ins');ins.className='adsbygoogle';ins.style.display='block';
 ins.setAttribute('data-ad-client',publisher);ins.setAttribute('data-ad-slot',slot);
 ins.setAttribute('data-ad-format','auto');ins.setAttribute('data-full-width-responsive','true');
 area.append(ins);area.hidden=false;return ins
}
async function start(){
 try{
  const response=await fetch('/api/ads-config',{cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Ad config unavailable');
  const config=await response.json();
  if(!config.enabled){writeStatus('Ads are not active.');return}
  const publisher=String(config.publisherId||'');
  if(!/^ca-pub-\d{16}$/.test(publisher)){writeStatus('Publisher is not configured.');return}
  const slot=String(config.placements?.guides||'');
  if(!/^\d{5,25}$/.test(slot))return;
  const pending=areas.filter(area=>area.dataset.ravrentAd==='guides').map(area=>renderArea(area,publisher,slot));
  if(!pending.length)return;
  const script=document.createElement('script');script.async=true;
  script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(publisher);
  script.crossOrigin='anonymous';
  script.onload=()=>{for(const unit of pending){try{if(unit.isConnected)(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch{}}};
  script.onerror=()=>{for(const area of areas){area.hidden=true;area.replaceChildren()}writeStatus('Ads could not load. The guides remain free.')};
  document.head.append(script)
 }catch(e){writeStatus('Ads are unavailable. The guides remain free.')}
}
start();
})();