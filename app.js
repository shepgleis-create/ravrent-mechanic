(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const glyph={menu:'M4 6h16M4 12h16M4 18h16',plus:'M12 5v14M5 12h14',car:'M3 15l3-9h12l3 9M4 15h16v5h-3v-2H7v2H4z',search:'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16M17 17l5 5',chat:'M3 12a9 9 0 0 1 18 0a9 9 0 0 1-9 9H5l-2 2z',book:'M6 3h11l3 3v15H6zM16 3v4h4M9 12h8M9 16h8',gear:'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2',spark:'M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z',globe:'M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18',send:'M12 19V5M5 12l7-7 7 7',image:'M3 4h18v16H3zM5 17l5-5 4 4 3-3 3 4'};
const svg=(n,small)=>'<svg class="svg'+(small?' small-svg':'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(glyph[n]||glyph.spark)+'"/></svg>';
const KEY='ravrent-mechanic-v2';
function fresh(){return {vehicles:[],activeVehicleId:null,threads:[],currentId:null,reports:[],deep:false,research:false};}
function migrate(){const s=fresh();try{const old=JSON.parse(localStorage.getItem('ravrent-mechanic-v1')||'null');if(old){
 s.vehicles=Array.isArray(old.vehicles)?old.vehicles.map(v=>({...v,service:[]})):[];
 s.activeVehicleId=old.active||null;s.reports=Array.isArray(old.reports)?old.reports:[];
 if(Array.isArray(old.messages)&&old.messages.some(m=>m.role==='user')){const id=uid();s.threads=[{id,title:'Previous diagnosis',vehicleId:s.activeVehicleId,messages:old.messages,created:Date.now(),updated:Date.now()}];s.currentId=id;}
 }}catch(e){}return s;}
let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null')||migrate();if(!Array.isArray(data.threads)||!Array.isArray(data.vehicles))data=migrate();}catch(e){data=migrate();}
let pending=false,pendingPhoto='',pendingVideo=null,videoUploading=false,videoUploadId=0,view='diagnose',spinnerTimer=null,toastTimer=null;
const cooldownKey='ravrent_provider_cooldown_v1';
let cooldownUntil=0,cooldownTimer=null;
try{const saved=Number(localStorage.getItem(cooldownKey));if(Number.isFinite(saved)&&saved>Date.now()&&saved<Date.now()+86400000)cooldownUntil=saved}catch{}
function secondsLeft(){return Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000))}
function updateCooldownUI(){
 const remaining=secondsLeft(),notice=$('cooldownNotice');
 if(notice){
  notice.classList.toggle('hide',remaining===0);
  notice.textContent=remaining?'AI usage limit: retry in '+(remaining>=60?Math.ceil(remaining/60)+' minute(s)':remaining+' seconds')+'. Starting a new conversation does not reset the provider allowance.':'';
 }
 if($('sendButton'))$('sendButton').disabled=pending||videoUploading||remaining>0;
 document.querySelectorAll('[data-retry]').forEach(b=>{b.disabled=remaining>0;b.title=remaining?'Wait until the provider quota resets':''});
 if(remaining){
  if(!cooldownTimer)cooldownTimer=setInterval(updateCooldownUI,1000);
 }else{
  if(cooldownTimer){clearInterval(cooldownTimer);cooldownTimer=null}
  if(cooldownUntil){cooldownUntil=0;try{localStorage.removeItem(cooldownKey)}catch{}}
 }
}
function recordCooldown(seconds){
 const n=Number(seconds);if(!Number.isFinite(n)||n<=0)return;
 cooldownUntil=Date.now()+Math.min(86400,Math.ceil(n))*1000;
 try{localStorage.setItem(cooldownKey,String(cooldownUntil))}catch{}
 updateCooldownUI();
}
function store(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){notify('Local storage is full. Delete older conversations.');}}
if(data.budgetProfileVersion!==1){
 // Earlier versions turned expensive deep research on automatically.
 // Reset just once to a functional economical default, with user opt-in.
 data.deep=false;data.research=false;data.budgetProfileVersion=1;store();
}
function notify(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3900);}
function modal(s){$(s).classList.add('open');}function close(s){$(s).classList.remove('open');}
function car(){return data.vehicles.find(v=>v.id===data.activeVehicleId)||null;}
function carFor(t){return data.vehicles.find(v=>v.id===(t?.vehicleId||data.activeVehicleId))||null;}
const carName=v=>v?(v.year+' '+v.make+' '+v.model):'No vehicle selected';
function current(){return data.threads.find(t=>t.id===data.currentId)||null;}
function ensureThread(){let t=current();if(!t){t={id:uid(),title:'New conversation',vehicleId:data.activeVehicleId||null,messages:[],created:Date.now(),updated:Date.now()};data.threads.unshift(t);data.currentId=t.id;store();}return t;}
function newChat(){data.currentId=null;ensureThread();view='diagnose';render();$('messageInput').focus();}
function closeSidebar(){$('sidebar').classList.remove('open');$('sidebarOverlay').classList.remove('open');}
function setView(n){view=n;closeSidebar();render();}
function renderNav(){
 const t=current();$('threadList').innerHTML=[...data.threads].sort((a,b)=>b.updated-a.updated).map(x=>
 '<div class="thread-row'+(x.id===t?.id?' active':'')+'"><button data-thread="'+esc(x.id)+'" title="'+esc(x.title)+'">'+esc(x.title||'New conversation')+'</button><button class="delete-thread" data-del="'+esc(x.id)+'" aria-label="Delete conversation">×</button></div>').join('');
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 $('titleTop').textContent=({diagnose:'Ravrent Mechanic',garage:'My Garage',codes:'Trouble Codes',reports:'Saved Reports',wizard:'Guided Diagnostics',health:'App Diagnostics'})[view]||'Ravrent Mechanic';
 $('threadList').querySelectorAll('[data-thread]').forEach(b=>b.onclick=()=>{data.currentId=b.dataset.thread;store();setView('diagnose');});
 $('threadList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
 if(!confirm('Delete this conversation from this browser?'))return;
 data.threads=data.threads.filter(t=>t.id!==b.dataset.del);
 if(data.currentId===b.dataset.del)data.currentId=data.threads[0]?.id||null;store();render();});
}
function inline(s){
 const tick=String.fromCharCode(96);let out=esc(s);
 out=out.split(tick).map((t,i)=>i%2===1?'<code>'+t+'</code>':t).join('');
 out=out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
 out=out.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
 out=out.replace(/\[([^\]]{1,100})\]\((https:\/\/[^)\s]+)\)/g,(match,label,href)=>{try{const u=new URL(href.replace(/&amp;/g,'&'));return u.protocol==='https:'?'<a href="'+esc(u.href)+'" rel="noopener noreferrer" target="_blank">'+label+'</a>':match;}catch(e){return match;}});
 return out;
}
function markdown(s){
 let out='',para=[],li=[],kind='',code=[],fenced=false;
 const p=()=>{if(para.length){out+='<p>'+para.map(inline).join('<br>')+'</p>';para=[];}};
 const l=()=>{if(li.length){out+='<'+kind+'>'+li.map(t=>'<li>'+inline(t)+'</li>').join('')+'</'+kind+'>';li=[];kind='';}};
 for(const raw of String(s||'').split('\n')){const x=raw.trim();
  if(x.charCodeAt(0)===96&&x.charCodeAt(1)===96&&x.charCodeAt(2)===96){p();l();if(fenced){out+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';code=[];fenced=false;}else fenced=true;continue;}
  if(fenced){code.push(raw);continue;}
  if(!x){p();l();continue;}
  const h=x.match(/^(#{1,3})\s+(.+)$/);if(h){p();l();out+='<h3>'+inline(h[2])+'</h3>';continue;}
  const b=x.match(/^[-*]\s+(.+)/),n=x.match(/^\d+[.)]\s+(.+)/);
  if(b||n){p();const k=b?'ul':'ol';if(kind&&kind!==k)l();kind=k;li.push((b||n)[1]);continue;}
  l();para.push(x);
 }p();l();if(code.length)out+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';return out;
}
function messageHtml(m,i){
 if(m.role==='user')return '<div class="message user"><div class="message-body">'+(m.image?'<img class="attachment" alt="Vehicle photo" src="'+esc(m.image)+'">':'')+(m.video?'<div class="video-pill"><span>▶</span> '+(m.video.source==='sampled-frames'?'Video still frames (no audio)':'Video recording')+' · '+esc(m.video.label||'Vehicle recording')+'</div>':'')+'<div>'+esc(m.text||'')+'</div></div></div>';
 if(m.role==='error')return '<div class="message assistant"><div class="who">!</div><div class="message-body error-note"><strong>'+((m.code==='AI_QUOTA'||m.code==='APP_USAGE_LIMIT')?'AI usage limit reached':'AI provider unavailable')+'</strong><p>'+esc(m.text||'The service is not responding.')+'</p><div class="error-actions"><button data-open-health="1">Connection details</button><button data-open-wizard="1">Guided diagnostics</button><button data-retry="'+i+'">Retry</button></div></div></div>';
 let sources=Array.isArray(m.sources)?m.sources.filter(s=>s?.url&&/^https:\/\//.test(s.url)):[];
 const links=sources.length?'<div class="sources">'+sources.map(s=>'<a class="source" target="_blank" rel="noopener noreferrer" href="'+esc(s.url)+'">'+svg('globe',true)+esc(s.title||'Reference source')+'</a>').join('')+'</div>':'';
 const research=m.researchRequested?(m.researchPerformed?'Web research used'+(sources.length?' · '+sources.length+' references':''):'No verified web sources returned'):'Web research not requested';
 return '<div class="message assistant"><div class="who">R</div><div class="message-body">'+markdown(m.text)+links+(m.researchNote?'<div class="analysis-note">'+esc(m.researchNote)+'</div>':'')+'<div class="message-meta">'+esc(m.mode||'AI response')+' · '+research+'</div></div></div>';
}
function renderChat(){
 const t=ensureThread();$('welcome').classList.toggle('hide',!!t.messages.length);
 $('chatList').innerHTML=t.messages.map(messageHtml).join('');
 $('chatList').querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>retry(Number(b.dataset.retry)));
 $('chatList').querySelectorAll('[data-open-health]').forEach(b=>b.onclick=()=>setView('health'));
 $('chatList').querySelectorAll('[data-open-wizard]').forEach(b=>b.onclick=()=>setView('wizard'));
 $('activeVehicleLabel').textContent=carName(carFor(t));
 for(const [name,active] of [['deep',data.deep===true],['web',data.research===true]]){
  const b=$(name+'Toggle');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 }
 $('sendButton').disabled=pending||videoUploading||secondsLeft()>0;
 if(pending)spinner();else unspin();
 updateCooldownUI();
 requestAnimationFrame(()=>scrollBottom());
}
function scrollBottom(){const s=$('chatScroll');if(s)s.scrollTop=s.scrollHeight;}
function spinner(){
 if(!$('spinner')){const n=document.createElement('div');n.id='spinner';n.className='message assistant';n.innerHTML='<div class="who">R</div><div class="thinking"><span class="spinner"></span><span id="thinkingText">Analyzing the issue…</span></div>';$('chatList').append(n);}
 const phrases=data.research===true?['Analyzing the issue…','Comparing diagnostic possibilities…','Waiting for research and diagnostic response…','Preparing your answer…']:['Analyzing the issue…','Evaluating the symptoms…','Preparing your answer…'];
 let i=0;clearInterval(spinnerTimer);spinnerTimer=setInterval(()=>{if($('thinkingText'))$('thinkingText').textContent=phrases[++i%phrases.length];},6500);scrollBottom();
}
function unspin(){clearInterval(spinnerTimer);$('spinner')?.remove();}
function busy(v){pending=v;$('sendButton').disabled=v||videoUploading||secondsLeft()>0;$('messageInput').disabled=v;if(v)spinner();else unspin();}
async function send(text,isRetry){
 const q=String(text||'').trim();if(secondsLeft()>0){updateCooldownUI();return}if(pending||videoUploading||(!q&&!pendingPhoto&&!pendingVideo))return;
 const t=ensureThread();
 if(!isRetry){t.messages.push({role:'user',text:q||(pendingVideo?.source==='sampled-frames'?'Please review the visible snapshots of this clip. Audio and motion between frames are not available.':pendingVideo?'Please review this vehicle recording.':'Please inspect this vehicle photo.'),image:pendingPhoto||null,video:pendingVideo||null,at:Date.now()});if(t.title==='New conversation')t.title=(q||(pendingVideo?'Video diagnosis':'Vehicle photo analysis')).slice(0,46);}
 pendingPhoto='';pendingVideo=null;$('photoPreview').classList.add('hide');$('photoInput').value='';$('videoPreview').classList.add('hide');$('videoInput').value='';$('messageInput').value='';t.updated=Date.now();
 store();renderNav();renderChat();busy(true);
 try{
  const selected=t.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(data.deep===true?-7:-5);
  // Prior photos and videos are never resent automatically on follow-ups.
  const lastImage=selected.length-1;
  const lastVideo=selected.length-1;
  const messages=selected.map((m,i)=>({
   role:m.role,text:m.text,...(m.image&&i===lastImage?{image:m.image}:{}),...(m.video&&i===lastVideo?{video:m.video}:{}),...(m.modelParts?{modelParts:m.modelParts}:{})
  }));
  const aiAbort=new AbortController(),aiTimer=setTimeout(()=>aiAbort.abort(),60000);
  let response;
  try{response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:aiAbort.signal,
   body:JSON.stringify({vehicle:carFor(t),messages,deep:data.deep===true,research:data.research===true})})}finally{clearTimeout(aiTimer)}
  let result={};try{result=await response.json();}catch(e){}
  if(!response.ok||!result.reply){const error=new Error(result.error||'The server did not return an AI answer.');error.status=response.status;error.code=result.code||'AI_REQUEST';error.retryAfterSeconds=result.retryAfterSeconds||Number(response.headers?.get?.('Retry-After'))||null;error.rateLimitScope=result.rateLimitScope||null;throw error;}
  try{localStorage.setItem('ravrent_ai_last_status',JSON.stringify({ok:true,code:'CONNECTED',message:(result.provider||'AI provider')+' returned a real AI response.',time:Date.now()}))}catch{}
  if($('connection')){$('connection').textContent='AI connected';$('connection').classList.add('ready');$('connection').classList.remove('warning')}
  t.messages.push({role:'assistant',text:result.reply,mode:result.mode||'AI response',
   sources:result.sources||[],researchRequested:result.researchRequested,researchPerformed:result.researchPerformed,researchNote:result.researchNote||null,
   modelParts:result.modelParts||null,at:Date.now()});
 }catch(e){
  const reason=e.name==='AbortError'?'The AI request timed out. Try again without web research or use Guided Diagnostics.':e.message||'The assistant is unavailable right now. Please try again soon.';
  const code=e.name==='AbortError'?'TIMEOUT':e.code||'AI_NETWORK';
  try{localStorage.setItem('ravrent_ai_last_status',JSON.stringify({ok:false,code,message:reason,time:Date.now()}))}catch{}
  if((code==='AI_QUOTA'||code==='APP_USAGE_LIMIT')&&e.retryAfterSeconds)recordCooldown(e.retryAfterSeconds);
  if($('connection')){$('connection').textContent=code==='AI_QUOTA'||code==='APP_USAGE_LIMIT'?'AI rate limited':'AI offline';$('connection').classList.remove('ready');$('connection').classList.add('warning')}
  t.messages.push({role:'error',text:reason,code,rateLimitScope:e.rateLimitScope||null,at:Date.now()});
 }finally{t.updated=Date.now();busy(false);store();renderNav();renderChat();}
}
function retry(i){
 if(secondsLeft()>0){updateCooldownUI();return}
 const t=current();if(!t||t.messages.at(-1)?.role!=='error')return;
 const previous=t.messages.slice(0,i).reverse().find(m=>m.role==='user');if(!previous)return;
 t.messages.pop();send(previous.text,true);
}
function serviceRow(s){return '<div class="service-row"><strong>'+esc(s.date||'Date unknown')+' · '+esc(s.type||'Service')+'</strong>'+esc(s.note||'')+(s.miles?' · '+Number(s.miles).toLocaleString()+' miles':'')+'</div>';}
function renderGarage(){
 const grid=$('garageGrid');
 if(!data.vehicles.length){grid.innerHTML='<div class="empty"><h3>No vehicles saved</h3><p>Add a vehicle so the assistant can use the engine, mileage and repair history.</p><button id="firstCar" class="primary-btn">Add vehicle</button></div>';$('firstCar').onclick=()=>modal('vehicleModal');return;}
 grid.innerHTML=data.vehicles.map(v=>'<div class="item-card"><div class="item-head"><span class="tag'+(v.id===data.activeVehicleId?' active':'')+'">'+(v.id===data.activeVehicleId?'ACTIVE':'SAVED')+'</span>'+svg('car')+'</div><h3>'+esc(carName(v))+'</h3><p>'+esc(v.engine||'Engine unspecified')+' · '+(v.miles?Number(v.miles).toLocaleString()+' miles':'Mileage unknown')+'</p>'+
 '<div class="card-actions"><button class="outline-btn" data-use="'+esc(v.id)+'">Use in chat</button><button class="outline-btn" data-service="'+esc(v.id)+'">Add service</button><button class="outline-btn" data-delete-car="'+esc(v.id)+'">Remove</button></div>'+
 '<details style="margin-top:17px"><summary style="cursor:pointer;font-size:12px;color:#777">Maintenance history ('+(v.service?.length||0)+')</summary>'+
 (v.service?.length?v.service.slice().reverse().map(serviceRow).join(''):'<div class="service-row muted">No records yet</div>')+'</details></div>').join('');
 grid.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{data.activeVehicleId=b.dataset.use;const t=current();if(t)t.vehicleId=b.dataset.use;store();setView('diagnose');notify('Vehicle selected for AI diagnostics.');});
 grid.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>{$('serviceForm').reset();$('serviceVehicleId').value=b.dataset.service;modal('serviceModal');});
 grid.querySelectorAll('[data-delete-car]').forEach(b=>b.onclick=()=>{if(!confirm('Remove this vehicle and its service notes?'))return;data.vehicles=data.vehicles.filter(v=>v.id!==b.dataset.deleteCar);if(data.activeVehicleId===b.dataset.deleteCar)data.activeVehicleId=data.vehicles[0]?.id||null;store();renderGarage();});
}
const CODES={
P0010:['Camshaft actuator circuit — bank 1','VVT electrical or oil control issue','Check sensor data, wiring and command response'],
P0011:['Camshaft timing over-advanced — bank 1','VVT actuator, oil supply, timing','Compare actual vs commanded cam timing'],
P0016:['Crank/cam correlation — bank 1 sensor A','Mechanical timing, VVT or sensor signals','Verify oil condition and timing signal correlation'],
P0101:['MAF sensor range/performance','Intake leaks, airflow reading, wiring','Inspect intake boot and live MAF data'],
P0117:['Coolant temperature sensor circuit low','Sensor circuit or wiring','Compare temperature to ambient on cold engine'],
P0128:['Coolant thermostat below regulating temperature','Thermostat or temperature signal','Review warm-up temperature against verified service data'],
P0171:['System too lean — bank 1','Unmetered air, weak fuel delivery, MAF','Look at short/long fuel trims and leak test'],
P0174:['System too lean — bank 2','Unmetered air, fuel delivery, MAF','Compare bank fuel trims and intake leaks'],
P0300:['Random/multiple cylinder misfire','Ignition, fueling, airflow, compression','Review misfire counts and fuel trims'],
P0301:['Cylinder 1 misfire','Coil, plug, injector or mechanical','Verify affected cylinder, test ignition and compression'],
P0302:['Cylinder 2 misfire','Coil, plug, injector or mechanical','Compare ignition/fuel function with neighboring cylinders'],
P0303:['Cylinder 3 misfire','Coil, plug, injector or mechanical','Test spark, fuel and compression'],
P0304:['Cylinder 4 misfire','Coil, plug, injector or mechanical','Test spark, fuel and compression'],
P0340:['Camshaft position sensor A circuit — bank 1','Sensor, wiring, timing relation','Verify signal and correct bank'],
P0345:['Camshaft position sensor A circuit — bank 2','Sensor, wiring, timing relation','Verify ground, supply and signal'],
P0348:['Camshaft position sensor A circuit high — bank 2','Open or short, sensor signal, connector','Test wiring, supply and signal before buying a sensor'],
P0420:['Catalyst efficiency below threshold — bank 1','Exhaust leak, mixture or catalyst','Resolve misfires and exhaust leaks first'],
P0430:['Catalyst efficiency below threshold — bank 2','Exhaust leak, mixture or catalyst','Resolve misfires and exhaust leaks first'],
P0442:['EVAP small leak','Cap, hose or valve sealing','Check seals and smoke-test EVAP'],
P0455:['EVAP large leak','Cap, hoses or valve leak','Check for large EVAP leaks'],
P0500:['Vehicle speed sensor issue','Speed-signal circuit','Read ABS and transmission data'],
P0562:['System voltage low','Alternator, battery, grounds or wiring','Measure charging voltage under load and voltage drop'],
P0700:['Transmission control system fault request','Transmission ECU requested MIL','Scan TCM for specific fault codes'],
P0720:['Output speed sensor circuit malfunction','Transmission speed signal wiring/sensor','Inspect live speed data and circuit']};
function lookup(){
 const code=$('codeInput').value.trim().toUpperCase().replace(/\s/g,'');const b=$('codeResult');
 if(!/^[PBCU][0-3][0-9A-F]{3}$/.test(code)){b.innerHTML='<div class="result">Enter a valid trouble code like P0302, P0171, or P0348.</div>';return;}
 const c=CODES[code];
 b.innerHTML='<div class="result"><span class="tag">GENERIC DTC REFERENCE</span><h2 style="margin-top:13px">'+esc(code)+'</h2>'+
 (c?'<strong>'+esc(c[0])+'</strong><p><b>Related systems:</b> '+esc(c[1])+'</p><p><b>First check:</b> '+esc(c[2])+'</p>':'<p>Not included in the local reference library. Manufacturer-specific data may be required.</p>')+
 '<p class="muted" style="font-size:12px">A DTC is evidence of a condition, not proof that a part has failed.</p><button class="primary-btn" id="researchCode">Research this code</button></div>';
 $('researchCode').onclick=()=>{newChat();$('messageInput').value='Research diagnostic trouble code '+code+' for '+carName(car())+'. Explain causes, symptoms, useful manufacturer-specific details only if sourced, and the cheapest confirming tests.';$('messageInput').focus();};
}
function renderReports(){
 const box=$('reportGrid');if(!data.reports.length){box.innerHTML='<div class="empty"><h3>No reports saved yet</h3><p>Save your conversations to download detailed diagnostic records.</p></div>';return;}
 box.innerHTML=[...data.reports].reverse().map(r=>'<div class="item-card"><div class="item-head"><span class="tag">'+esc(new Date(r.date||r.created||Date.now()).toLocaleDateString())+'</span>'+svg('book')+'</div>'+
 '<h3>'+esc(r.vehicle||'General diagnosis')+'</h3><p>'+esc(r.summary||r.messages?.find(m=>m.role==='user')?.text||'Saved conversation').slice(0,150)+'</p>'+
 '<div class="card-actions"><button class="outline-btn" data-export="'+esc(r.id)+'">Download TXT</button><button class="outline-btn" data-remove-report="'+esc(r.id)+'">Delete</button></div></div>').join('');
 box.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{const r=data.reports.find(x=>x.id===b.dataset.export);if(r)exportReport(r);});
 box.querySelectorAll('[data-remove-report]').forEach(b=>b.onclick=()=>{if(!confirm('Delete this report?'))return;data.reports=data.reports.filter(x=>x.id!==b.dataset.removeReport);store();renderReports();});
}
function exportReport(r){
 const lines=['RAVRENT MECHANIC · DIAGNOSTIC REPORT','Date: '+new Date(r.date||r.created).toLocaleString(),'Vehicle: '+r.vehicle,'','AI recommendations are not a verified in-person inspection.',''];
 for(const m of r.messages||[]){lines.push((m.role==='user'?'DRIVER':m.role==='assistant'?'ASSISTANT':'ERROR')+':');lines.push(m.text||'');if(m.sources?.length){lines.push('Sources:');for(const s of m.sources)lines.push('- '+s.title+' — '+s.url);}lines.push('');}
 const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='ravrent-mechanic-'+new Date(r.date||Date.now()).toISOString().slice(0,10)+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function saveReport(){
 const t=current();if(!t||!t.messages.some(m=>m.role==='user'))return notify('Ask a question before saving a report.');
 data.reports.push({id:uid(),date:new Date().toISOString(),vehicle:carName(carFor(t)),summary:t.title,messages:t.messages.map(({role,text,sources})=>({role,text,sources}))});
 store();notify('Report saved to Reports.');
}
function render(){
 if(view==='diagnose')ensureThread();
 renderNav();$('chatPane').classList.toggle('hide',view!=='diagnose');
 $('garagePane').classList.toggle('hide',view!=='garage');$('codesPane').classList.toggle('hide',view!=='codes');$('reportsPane').classList.toggle('hide',view!=='reports');$('wizardPane').classList.toggle('hide',view!=='wizard');$('healthPane').classList.toggle('hide',view!=='health');
 if(view==='diagnose')renderChat();if(view==='garage')renderGarage();if(view==='codes')lookup();if(view==='reports')renderReports();
}
async function status(){
 const control=$('connection');if(!control)return;
 let previous=null;try{previous=JSON.parse(localStorage.getItem('ravrent_ai_last_status')||'null')}catch{}
 const recent=previous&&Number.isFinite(previous.time)&&Date.now()-previous.time<12*60*60*1000;
 try{
  const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw Error('Unavailable');
  const cfg=await response.json();
  const label=cfg.paused?'AI paused':cfg.setupRequired?'Groq setup needed':!cfg.configured?'AI not configured':recent?(previous.ok?'AI recently tested':'AI offline'):'AI not tested';
  control.textContent=label;
  control.classList.toggle('ready',Boolean(recent&&previous.ok&&!cfg.paused&&cfg.configured));
  control.classList.toggle('warning',!(recent&&previous.ok&&!cfg.paused&&cfg.configured))
 }catch{
  control.textContent=recent?(previous.ok?'AI last tested':'AI offline'):'AI status unknown';
  control.classList.remove('ready');control.classList.add('warning');
 }
}
async function attach(file){
 if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)){notify('Choose a JPEG, PNG, or WebP photo.');return;}
 if(file.size>11e6){notify('Please choose a photo under 11 MB.');return;}
 const url=await new Promise((yes,no)=>{const r=new FileReader();r.onload=()=>yes(r.result);r.onerror=no;r.readAsDataURL(file);});
 const img=await new Promise((yes,no)=>{const i=new Image();i.onload=()=>yes(i);i.onerror=no;i.src=url;});
 const factor=Math.min(1,1200/Math.max(img.width,img.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*factor));canvas.height=Math.max(1,Math.round(img.height*factor));
 canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
 const encoded=canvas.toDataURL('image/jpeg',.68);
 if(encoded.length>2400000){notify('Photo still too large. Try a smaller photo.');return;}
 pendingPhoto=encoded;$('photoThumbnail').src=encoded;$('photoPreview').classList.remove('hide');notify('Photo attached. Ask what you would like examined.');
}

function videoStatus(text,percentage){
 $('videoUploadStatus').textContent=text;
 $('videoProgress').value=Math.min(100,Math.max(0,percentage));
}
function videoMime(file){
 const m=(file?.type||'').toLowerCase().split(';')[0];
 if(m==='video/quicktime'||/\.mov$/i.test(file?.name||''))return 'video/mov';
 if(m==='video/x-m4v')return 'video/mp4';
 return ['video/mp4','video/mov','video/webm','video/mpeg','video/3gpp'].includes(m)?m:null;
}
async function videoLength(file){
 return new Promise(resolve=>{
  const element=document.createElement('video');
  const objectUrl=URL.createObjectURL(file);
  let done=false,timer=null;
  const finish=x=>{if(done)return;done=true;if(timer!==null)clearTimeout(timer);element.removeAttribute('src');element.load();URL.revokeObjectURL(objectUrl);resolve(x);};
  element.preload='metadata';
  element.onloadedmetadata=()=>finish(Number.isFinite(element.duration)?element.duration:null);
  element.onerror=()=>finish(null);
  timer=setTimeout(()=>finish(null),5000);
  element.src=objectUrl;
 });
}
async function apiJson(url,options){
 const r=await fetch(url,options);
 let out={};try{out=await r.json();}catch(e){}
 if(!r.ok){
   const error=new Error(out.error||((r.status===413)?'Video exceeds the upload size limit.':'Video service could not complete this step.'));
   error.status=r.status;error.code=out.code||'HTTP_ERROR';
   error.received=out.received;error.upstreamStatus=out.upstreamStatus;
   throw error;
 }
 return out;
}
function delay(ms){return new Promise(ok=>setTimeout(ok,ms));}
async function waitForVideo(name,id,uploaded){
 for(let i=0;i<36;i++){
  if(id!==videoUploadId)throw Error('Upload cancelled.');
  const state=await apiJson('/api/video-status?name='+encodeURIComponent(name),{cache:'no-store'});
  if(state.state==='ACTIVE'){uploaded.uri=state.uri||uploaded.uri;uploaded.mimeType=state.mimeType||uploaded.mimeType;return uploaded;}
  if(state.state==='FAILED')throw Error('This video could not be processed. Try MP4 or a shorter clip.');
  videoStatus('Processing video and audio…',100);
  await delay(2500);
 }
 throw Error('Video processing is taking longer than expected. Try attaching the video again shortly.');
}
async function attachVideo(file){
 if(!file)return;
 let provider='Groq';
 try{const response=await fetch('/api/status',{cache:'no-store'});if(response.ok){const body=await response.json();provider=body.provider||'Groq'}}catch{}
 if(provider!=='Gemini'){
  const id=++videoUploadId;
  videoUploading=true;pendingVideo=null;
  $('videoFileName').textContent=file.name||'Vehicle recording';
  $('videoPreview').classList.remove('hide');
  videoStatus('Preparing two visible frames on this device…',10);
  $('videoButton').disabled=true;$('sendButton').disabled=true;
  try{
   if(!window.RavrentVideoFrames?.extract)throw Error('Local video frame extraction is unavailable.');
   const result=await window.RavrentVideoFrames.extract(file,{count:2,maxDimension:600,quality:.58});
   if(id!==videoUploadId)return;
   pendingVideo={source:'sampled-frames',frames:result.frames,
    label:String(file.name||'Vehicle video').slice(0,100),duration:result.duration,uploadedAt:Date.now()};
   videoStatus('Two frames ready. Audio is not analyzed.',100);
   notify('Two video still frames are attached; sounds and continuous motion are not analyzed by this model.');
  }catch(e){
   if(id!==videoUploadId)return;
   pendingVideo=null;
   videoStatus('Frame extraction failed: '+(e.message||'Use photos instead.'),0);
   notify('Could not read this video. Try MP4, MOV or attach individual photos.');
  }finally{
   if(id===videoUploadId){videoUploading=false;$('videoButton').disabled=false;$('sendButton').disabled=pending||secondsLeft()>0}
  }
  return;
 }
 const mime=videoMime(file),MAX=32*1024*1024;
 if(!mime){notify('Choose an MP4, MOV or WebM recording.');return;}
 if(file.size<1||file.size>MAX){notify('The current video limit is 32 MB. Choose a shorter clip.');return;}
 if(videoUploading){notify('Wait for your current upload or cancel it first.');return;}
 const id=++videoUploadId;
 videoUploading=true;pendingVideo=null;
 $('videoFileName').textContent=file.name||'Vehicle recording';
 $('videoPreview').classList.remove('hide');videoStatus('Checking the recording…',0);
 $('sendButton').disabled=true;$('videoButton').disabled=true;
 try{
  const duration=await videoLength(file);
  if(id!==videoUploadId)return;
  if(duration!==null&&duration>90)throw Error('Choose a recording no longer than 90 seconds. Short clips are easier to diagnose.');
  videoStatus('Starting encrypted upload…',0);
  const init=await apiJson('/api/video-start',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({name:file.name,size:file.size,mimeType:mime})});
  const chunkSize=Math.max(262144,Math.min(3*1024*1024,init.chunkSize||1024*1024));
  let finished=null,offset=0,iterations=0;
  while(offset<file.size){
   if(id!==videoUploadId)return;
   if(++iterations>200)throw Error('The video upload could not make progress. Try a shorter clip.');
   const end=Math.min(file.size,offset+chunkSize);
   const piece=await file.slice(offset,end).arrayBuffer();
   let result=null,resumed=false,lastError=null;
   for(let attempt=0;attempt<3;attempt++){
    if(id!==videoUploadId)return;
    try{
     result=await apiJson('/api/video-chunk',{method:'POST',headers:{
       'Content-Type':'application/octet-stream','x-upload-session':init.session,
       'x-upload-offset':String(offset),'x-upload-final':end===file.size?'1':'0'
     },body:piece});
     break;
    }catch(error){
     lastError=error;
     if(error.code==='RESUME_AT_OFFSET'&&Number.isInteger(error.received)&&error.received>=0&&error.received<=file.size){
      if(error.received===offset) { /* Retry the same chunk. */ }
      else { offset=error.received;resumed=true;break; }
     }
     if(!resumed&&attempt<2&&(!error.status||[408,429,502,503,504].includes(error.status))){
      videoStatus('Reconnecting… '+Math.floor(offset/file.size*100)+'%',Math.floor(offset/file.size*100));
      await delay(900*(attempt+1));
      continue;
     }
     if(!resumed)break;
    }
   }
   if(resumed){
    videoStatus('Resuming video transfer… '+Math.floor(offset/file.size*100)+'%',Math.floor(offset/file.size*100));
    continue;
   }
   if(!result){
    const message=lastError?.message||'Upload interrupted.';
    throw Error('Transfer stopped at '+Math.floor(offset/file.size*100)+'%: '+message+
      (lastError?.code?' ['+lastError.code+']':''));
   }
   if(result.complete)finished=result.file;
   if(result.received!==undefined&&result.received!==end)
    throw Error('Video service confirmed an unexpected byte offset. Retry the upload.');
   offset=end;
   videoStatus('Uploading video and sound… '+Math.floor(offset/file.size*100)+'%',Math.floor(offset/file.size*100));
  }
  if(!finished?.name||!finished.uri)throw Error('The video did not finish uploading.');
  const meta={uri:finished.uri,mimeType:finished.mimeType||mime,name:finished.name,label:(file.name||'Vehicle video').slice(0,100),uploadedAt:Date.now(),duration:duration===null?null:Math.round(duration)};
  const ready=finished.state==='ACTIVE'?meta:await waitForVideo(finished.name,id,meta);
  if(id!==videoUploadId)return;
  pendingVideo=ready;videoStatus('Video ready — ask a question to analyze it',100);
  notify('Video and audio attached. Describe what you want investigated.');
 }catch(e){
  if(id!==videoUploadId)return;
  pendingVideo=null;videoStatus('Upload failed: '+(e.message||'Try a shorter clip.'),0);
  notify('Video transfer stopped. The attachment shows the reason and progress.');
 }finally{
  if(id===videoUploadId){videoUploading=false;$('sendButton').disabled=pending;$('videoButton').disabled=false;}
 }
}

$('menuToggle').onclick=()=>{let a=$('sidebar').classList.toggle('open');$('sidebarOverlay').classList.toggle('open',a);};
$('sidebarOverlay').onclick=closeSidebar;
$('newThread').onclick=newChat;$('newChatTop').onclick=newChat;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('settingsButton').onclick=()=>modal('aiModal');
$('connection').onclick=()=>setView('health');
$('vehicleButton').onclick=()=>setView('garage');
$('addVehicle').onclick=()=>{$('vehicleForm').reset();modal('vehicleModal');};
$('saveReport').onclick=saveReport;
$('deepToggle').onclick=()=>{data.deep=!(data.deep===true);store();renderChat();};
$('webToggle').onclick=()=>{data.research=!(data.research===true);store();renderChat();};
$('messageInput').oninput=()=>{const x=$('messageInput');x.style.height='auto';x.style.height=Math.min(x.scrollHeight,160)+'px';};
$('messageInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send($('messageInput').value);}};
$('sendButton').onclick=()=>send($('messageInput').value);
$('codeLookup').onclick=lookup;$('codeInput').onkeydown=e=>{if(e.key==='Enter')lookup();};
$('photoButton').onclick=()=>$('photoInput').click();
$('photoInput').onchange=async()=>{try{await attach($('photoInput').files[0]);}catch(e){notify('Could not load this photo.');}};
$('removePhoto').onclick=()=>{pendingPhoto='';$('photoPreview').classList.add('hide');$('photoInput').value='';};
$('videoButton').onclick=()=>$('videoInput').click();
$('videoInput').onchange=async()=>{try{await attachVideo($('videoInput').files[0]);}catch(e){notify('Could not open this recording.');}};
$('removeVideo').onclick=()=>{videoUploadId++;videoUploading=false;pendingVideo=null;$('videoPreview').classList.add('hide');$('videoInput').value='';$('videoButton').disabled=false;$('sendButton').disabled=pending;};
document.querySelectorAll('[data-suggestion]').forEach(b=>b.onclick=()=>{$('messageInput').value=b.dataset.suggestion;$('messageInput').focus();});
$('decodeVin').onclick=async()=>{
 const vin=$('vehicleVin').value.trim().toUpperCase().replace(/\s/g,'');
 const label=$('vinDecodeStatus'),button=$('decodeVin');
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)){label.textContent='Please enter a valid 17-character VIN without I, O or Q.';return;}
 button.disabled=true;label.textContent='Checking official vehicle records…';
 try{
  const response=await fetch('/api/vin?vin='+encodeURIComponent(vin),{cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Vehicle identification unavailable.');
  const form=$('vehicleForm');
  for(const key of ['year','make','model']){
   if(form.elements.namedItem(key))form.elements.namedItem(key).value=data[key]||'';
  }
  if(form.elements.namedItem('engine'))form.elements.namedItem('engine').value=[data.engine,data.trim].filter(Boolean).join(' · ').slice(0,80);
  label.textContent='Vehicle identified: '+data.year+' '+data.make+' '+data.model+'. Verify all details before saving.';
 }catch(e){label.textContent=e.message||'Unable to decode. Please enter vehicle details manually.';}
 finally{button.disabled=false;}
};
$('vehicleForm').onsubmit=e=>{
 e.preventDefault();const f=new FormData(e.target),v={id:uid(),year:Number(f.get('year')),make:String(f.get('make')||'').trim(),model:String(f.get('model')||'').trim(),engine:String(f.get('engine')||'').trim(),vin:String(f.get('vin')||'').trim().toUpperCase().slice(0,17),miles:Number(f.get('miles')||0),service:[]};
 if(!v.make||!v.model||v.year<1950||v.year>2030||v.miles<0)return notify('Check your vehicle details.');
 data.vehicles.push(v);data.activeVehicleId=v.id;const t=current();if(t)t.vehicleId=v.id;store();close('vehicleModal');render();notify('Vehicle saved.');
};
$('serviceForm').onsubmit=e=>{
 e.preventDefault();const f=new FormData(e.target),v=data.vehicles.find(x=>x.id===String(f.get('vehicleId')));
 if(!v)return notify('Vehicle not found.');
 if(!Array.isArray(v.service))v.service=[];v.service.push({date:String(f.get('date')||''),type:String(f.get('type')||'Service').slice(0,45),miles:Number(f.get('miles')||0),note:String(f.get('note')||'').trim().slice(0,600)});
 store();close('serviceModal');renderGarage();notify('Service record saved.');
};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close));
document.querySelectorAll('.modal-back').forEach(m=>m.onclick=e=>{if(e.target===m)close(m.id);});
window.RavrentApp={
 addGuidedReport(report){
  if(!report||typeof report!=='object'||!report.id||!Array.isArray(report.messages))return false;
  data.reports.push(report);store();return true;
 },
 openChatWithQuestion(question){setView('diagnose');$('messageInput').value=String(question||'').slice(0,3200);$('messageInput').focus();}
};
render();status();
try{
 const raw=sessionStorage.getItem('ravrent_ai_intake_v1');
 if(raw){sessionStorage.removeItem('ravrent_ai_intake_v1');const entry=JSON.parse(raw);
  if(entry&&['vin','workshop','health'].includes(entry.source)&&typeof entry.question==='string'&&Date.now()-Number(entry.created||0)<15*60*1000){
   setView('diagnose');$('messageInput').value=entry.question.slice(0,3200);$('messageInput').focus();
   notify('Vehicle context prepared for AI. Review and tap Send; no request was made automatically.');
  }
 }
}catch{}
})();