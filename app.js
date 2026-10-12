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
let passcode='',pending=false,pendingPhoto='',view='diagnose',spinnerTimer=null,toastTimer=null;
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
 if(m.role==='error')return '<div class="message assistant"><div class="who">!</div><div class="message-body error-note"><strong>Gemini could not answer.</strong> '+esc(m.text)+'<div><button data-retry="'+i+'">Retry question</button></div></div></div>';
 let sources=Array.isArray(m.sources)?m.sources.filter(s=>s?.url&&/^https:\/\//.test(s.url)):[];
 const links=sources.length?'<div class="sources">'+sources.map(s=>'<a class="source" target="_blank" rel="noopener noreferrer" href="'+esc(s.url)+'">'+svg('globe',true)+esc(s.title||'Reference source')+'</a>').join('')+'</div>':'';
 const research=m.researchRequested?(m.researchPerformed?'Google research used'+(sources.length?' · '+sources.length+' references':''):'No verified web sources returned'):'Web research not requested';
 return '<div class="message assistant"><div class="who">R</div><div class="message-body">'+markdown(m.text)+links+'<div class="message-meta">'+esc(m.model||'Gemini')+' · '+esc(m.mode||'AI answer')+' · '+research+'</div></div></div>';
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
 if(!$('spinner')){const n=document.createElement('div');n.id='spinner';n.className='message assistant';n.innerHTML='<div class="who">R</div><div class="thinking"><span class="spinner"></span><span id="thinkingText">Gemini is analyzing your question…</span></div>';$('chatList').append(n);}
 const phrases=data.research!==false?['Gemini is analyzing your question…','Comparing diagnostic possibilities…','Waiting for research and diagnostic response…','Preparing your answer…']:['Gemini is analyzing your question…','Evaluating the symptoms…','Preparing your answer…'];
 let i=0;clearInterval(spinnerTimer);spinnerTimer=setInterval(()=>{if($('thinkingText'))$('thinkingText').textContent=phrases[++i%phrases.length];},6500);scrollBottom();
}
function unspin(){clearInterval(spinnerTimer);$('spinner')?.remove();}
function busy(v){pending=v;$('sendButton').disabled=v;$('messageInput').disabled=v;if(v)spinner();else unspin();}
async function send(text,isRetry){
 const q=String(text||'').trim();if(pending||(!q&&!pendingPhoto))return;
 if(!passcode){modal('aiModal');notify('Enter your private access code to use real Gemini AI.');return;}
 const t=ensureThread();
 if(!isRetry){t.messages.push({role:'user',text:q||'What does this vehicle photo show?',image:pendingPhoto||null,at:Date.now()});if(t.title==='New conversation')t.title=(q||'Vehicle photo analysis').slice(0,46);}
 pendingPhoto='';$('photoPreview').classList.add('hide');$('photoInput').value='';$('messageInput').value='';t.updated=Date.now();
 store();renderNav();renderChat();busy(true);
 try{
  const messages=t.messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-18).map(m=>({
   role:m.role,text:m.text,...(m.image?{image:m.image}:{}),...(m.modelParts?{modelParts:m.modelParts}:{})
  }));
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json','x-app-passcode':passcode},
   body:JSON.stringify({vehicle:carFor(t),messages,deep:data.deep!==false,research:data.research!==false})});
  let result={};try{result=await response.json();}catch(e){}
  if(!response.ok||!result.reply){let error=new Error(result.error||'The server did not return an AI answer.');error.status=response.status;throw error;}
  t.messages.push({role:'assistant',text:result.reply,model:result.model||'Gemini',mode:result.mode||'AI answer',
   sources:result.sources||[],researchRequested:result.researchRequested,researchPerformed:result.researchPerformed,
   modelParts:result.modelParts||null,at:Date.now()});
 }catch(e){
  const reason=e.status===401?'Private access code rejected; reconnect with the correct code.':e.status===503?'Gemini is not configured on Vercel. Set environment variables and redeploy.':e.message||'Network failed.';
  t.messages.push({role:'error',text:reason,at:Date.now()});
  if(e.status===401)passcode='';
 }finally{t.updated=Date.now();busy(false);store();renderNav();renderChat();}
}
function retry(i){
 const t=current();if(!t||t.messages.at(-1)?.role!=='error')return;
 const previous=t.messages.slice(0,i).reverse().find(m=>m.role==='user');if(!previous)return;
 t.messages.pop();send(previous.text,true);
}
