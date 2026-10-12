(async()=>{
 const target=document.getElementById('adArea');
 if(!target)return;
 try{
  const response=await fetch('/api/ads-config',{cache:'no-store'});
  if(!response.ok)return;
  const data=await response.json();
  if(!data.enabled||!/^ca-pub-\d{16}$/.test(data.publisherId||''))return;
  // Only public article pages load ad code; never insert it into private chat.
  const script=document.createElement('script');
  script.async=true;script.crossOrigin='anonymous';
  script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(data.publisherId);
  script.onerror=()=>{target.hidden=true;};
  document.head.appendChild(script);
  target.hidden=false;
 }catch(e){target.hidden=true;}
})();