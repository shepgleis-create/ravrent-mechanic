(()=>{'use strict';
const button=document.getElementById('toggleGuideAds'),status=document.getElementById('adPreferenceStatus');
if(!button||!status)return;
const key='ravrent_ads_disabled';
function render(){
 try{const disabled=localStorage.getItem(key)==='true';
  button.textContent=disabled?'Allow optional guide ads on this browser':'Hide optional guide ads on this browser';
  status.textContent=disabled?'Optional public-guide ads are hidden on this browser.':'Guide ads are permitted by this browser preference, but still require publisher approval and compliance setup.'
 }catch{button.disabled=true;status.textContent='Browser storage is unavailable; preference cannot be saved.'}
}
button.addEventListener('click',()=>{try{
 const disabled=localStorage.getItem(key)==='true';
 localStorage.setItem(key,disabled?'false':'true');render()
 }catch{status.textContent='Could not save advertising preference on this browser.'}
});
render();
})();