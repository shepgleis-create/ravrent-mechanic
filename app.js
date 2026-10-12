(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const glyph={menu:'M4 6h16M4 12h16M4 18h16',plus:'M12 5v14M5 12h14',car:'M3 15l3-9h12l3 9M4 15h16v5h-3v-2H7v2H4z',search:'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16M17 17l5 5',chat:'M3 12a9 9 0 0 1 18 0a9 9 0 0 1-9 9H5l-2 2z',book:'M6 3h11l3 3v15H6zM16 3v4h4M9 12h8M9 16h8',gear:'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2',spark:'M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z',globe:'M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18',send:'M12 19V5M5 12l7-7 7 7',image:'M3 4h18v16H3zM5 17l5-5 4 4 3-3 3 4'};
const svg=(n,small)=>'<svg class="svg'+(small?' small-svg':'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(glyph[n]||glyph.spark)+'"/></svg>';
const KEY='ravrent-mechanic-v2';
function fresh(){return {vehicles:[],activeVehicleId:null,threads:[],currentId:null,reports:[],deep:true,research:true};}
function migrate(){const s=fresh();try{const old=JSON.parse(localStorage.getItem('ravrent-mechanic-v1')||'null');if(old){
 s.vehicles=Array.isArray(old.vehicles)?old.vehicles.map(v=>({...v,service:[]})):[];
 s.activeVehicleId=old.active||null;s.reports=Array.isArray(old.reports)?old.reports:[];
 if(Array.isArray(old.messages)&&old.messages.some(m=>m.role==='user')){const id=uid();s.threads=[{id,title:'Previous diagnosis',vehicleId:s.activeVehicleId,messages:old.messages,created:Date.now(),updated:Date.now()}];s.currentId=id;}
 }}catch(e){}return s;}
let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null')||migrate();if(!Array.isArray(data.threads)||!Array.isArray(data.vehicles))data=migrate();}catch(e){data=migrate();}
let pending=false,pendingPhoto='',view='diagnose',spinnerTimer=null,toastTimer=null;
function store(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){notify('Local storage is full. Delete older conversations.');}}
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
 $('titleTop').textContent=view==='diagnose'?'Ravrent Mechanic':view==='garage'?'My Garage':view==='codes'?'Trouble Codes':'Diagnostic Reports';
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
 if(m.role==='user')return '<div class="message user"><div class="message-body">'+(m.image?'<img class="attachment" alt="Vehicle photo" src="'+esc(m.image)+'">':'')+'<div>'+esc(m.text||'')+'</div></div></div>';
 if(m.role==='error')return '<div class="message assistant"><div class="who">!</div><div class="message-body error-note"><strong>The assistant could not complete this request.</strong> '+esc(/gemini|google/i.test(m.text||'')?'The previous request reached its usage limit. Retry using the updated assistant.':m.text)+'<div><button data-retry="'+i+'">Retry question</button></div></div></div>';
 let sources=Array.isArray(m.sources)?m.sources.filter(s=>s?.url&&/^https:\/\//.test(s.url)):[];
 const links=sources.length?'<div class="sources">'+sources.map(s=>'<a class="source" target="_blank" rel="noopener noreferrer" href="'+esc(s.url)+'">'+svg('globe',true)+esc(s.title||'Reference source')+'</a>').join('')+'</div>':'';
 const research=m.researchRequested?(m.researchPerformed?'Web research used'+(sources.length?' · '+sources.length+' references':''):'No verified web sources returned'):'Web research not requested';
 return '<div class="message assistant"><div class="who">R</div><div class="message-body">'+markdown(m.text)+links+(m.researchNote?'<div class="analysis-note">'+esc(m.researchNote)+'</div>':'')+'<div class="message-meta">'+esc(m.mode||'AI response')+' · '+research+'</div></div></div>';
}
function renderChat(){
 const t=ensureThread();$('welcome').classList.toggle('hide',!!t.messages.length);
 $('chatList').innerHTML=t.messages.map(messageHtml).join('');
 $('chatList').querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>retry(Number(b.dataset.retry)));
 $('activeVehicleLabel').textContent=carName(carFor(t));
 for(const [name,active] of [['deep',data.deep!==false],['web',data.research!==false]]){
  const b=$(name+'Toggle');b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 }
 $('sendButton').disabled=pending;
 if(pending)spinner();else unspin();
 requestAnimationFrame(()=>scrollBottom());
}
function scrollBottom(){const s=$('chatScroll');if(s)s.scrollTop=s.scrollHeight;}
function spinner(){
 if(!$('spinner')){const n=document.createElement('div');n.id='spinner';n.className='message assistant';n.innerHTML='<div class="who">R</div><div class="thinking"><span class="spinner"></span><span id="thinkingText">Analyzing the issue…</span></div>';$('chatList').append(n);}
 const phrases=data.research!==false?['Analyzing the issue…','Comparing diagnostic possibilities…','Waiting for research and diagnostic response…','Preparing your answer…']:['Analyzing the issue…','Evaluating the symptoms…','Preparing your answer…'];
 let i=0;clearInterval(spinnerTimer);spinnerTimer=setInterval(()=>{if($('thinkingText'))$('thinkingText').textContent=phrases[++i%phrases.length];},6500);scrollBottom();
}
function unspin(){clearInterval(spinnerTimer);$('spinner')?.remove();}
function busy(v){pending=v;$('sendButton').disabled=v;$('messageInput').disabled=v;if(v)spinner();else unspin();}
async function send(text,isRetry){
 const q=String(text||'').trim();if(pending||(!q&&!pendingPhoto))return;
 const t=ensureThread();
 if(!isRetry){t.messages.push({role:'user',text:q||'What does this vehicle photo show?',image:pendingPhoto||null,at:Date.now()});if(t.title==='New conversation')t.title=(q||'Vehicle photo analysis').slice(0,46);}
 pendingPhoto='';$('photoPreview').classList.add('hide');$('photoInput').value='';$('messageInput').value='';t.updated=Date.now();
 store();renderNav();renderChat();busy(true);
 try{
  const selected=t.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-18);
  const lastImage=selected.findLastIndex(m=>m.role==='user'&&m.image);
  const messages=selected.map((m,i)=>({
   role:m.role,text:m.text,...(m.image&&i===lastImage?{image:m.image}:{}),...(m.modelParts?{modelParts:m.modelParts}:{})
  }));
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({vehicle:carFor(t),messages,deep:data.deep!==false,research:data.research!==false})});
  let result={};try{result=await response.json();}catch(e){}
  if(!response.ok||!result.reply){let error=new Error(result.error||'The server did not return an AI answer.');error.status=response.status;throw error;}
  t.messages.push({role:'assistant',text:result.reply,mode:result.mode||'AI response',
   sources:result.sources||[],researchRequested:result.researchRequested,researchPerformed:result.researchPerformed,researchNote:result.researchNote||null,
   modelParts:result.modelParts||null,at:Date.now()});
 }catch(e){
  const reason=e.message||'The assistant is unavailable right now. Please try again soon.';
  t.messages.push({role:'error',text:reason,at:Date.now()});
 }finally{t.updated=Date.now();busy(false);store();renderNav();renderChat();}
}
function retry(i){
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
 $('garagePane').classList.toggle('hide',view!=='garage');$('codesPane').classList.toggle('hide',view!=='codes');$('reportsPane').classList.toggle('hide',view!=='reports');
 if(view==='diagnose')renderChat();if(view==='garage')renderGarage();if(view==='codes')lookup();if(view==='reports')renderReports();
}
async function status(){
 try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error();const obj=await r.json();
 $('connection').textContent=obj.configured?'Assistant configured':'Assistant unavailable';
 $('connection').classList.toggle('ready',!!obj.configured);$('connection').classList.toggle('warning',!obj.configured);
 }catch(e){$('connection').textContent='Check AI setup';$('connection').classList.add('warning');}
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
$('menuToggle').onclick=()=>{let a=$('sidebar').classList.toggle('open');$('sidebarOverlay').classList.toggle('open',a);};
$('sidebarOverlay').onclick=closeSidebar;
$('newThread').onclick=newChat;$('newChatTop').onclick=newChat;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('settingsButton').onclick=()=>modal('aiModal');
$('vehicleButton').onclick=()=>setView('garage');
$('addVehicle').onclick=()=>{$('vehicleForm').reset();modal('vehicleModal');};
$('saveReport').onclick=saveReport;
$('deepToggle').onclick=()=>{data.deep=!(data.deep!==false);store();renderChat();};
$('webToggle').onclick=()=>{data.research=!(data.research!==false);store();renderChat();};
$('messageInput').oninput=()=>{const x=$('messageInput');x.style.height='auto';x.style.height=Math.min(x.scrollHeight,160)+'px';};
$('messageInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send($('messageInput').value);}};
$('sendButton').onclick=()=>send($('messageInput').value);
$('codeLookup').onclick=lookup;$('codeInput').onkeydown=e=>{if(e.key==='Enter')lookup();};
$('photoButton').onclick=()=>$('photoInput').click();
$('photoInput').onchange=async()=>{try{await attach($('photoInput').files[0]);}catch(e){notify('Could not load this photo.');}};
$('removePhoto').onclick=()=>{pendingPhoto='';$('photoPreview').classList.add('hide');$('photoInput').value='';};
document.querySelectorAll('[data-suggestion]').forEach(b=>b.onclick=()=>{$('messageInput').value=b.dataset.suggestion;$('messageInput').focus();});
$('vehicleForm').onsubmit=e=>{
 e.preventDefault();const f=new FormData(e.target),v={id:uid(),year:Number(f.get('year')),make:String(f.get('make')||'').trim(),model:String(f.get('model')||'').trim(),engine:String(f.get('engine')||'').trim(),miles:Number(f.get('miles')||0),service:[]};
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
render();status();
})();