(()=>{
'use strict';
const by=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const CHOICES={
charging:{title:'Charging and electrical power',urgency:'Do not keep driving if steering, headlights, or essential electronics are cutting out.',
  questions:[
   {key:'lamp',title:'Does the battery/charging warning light appear with the engine running?',values:['Yes','No','Not sure']},
   {key:'running',title:'Does the engine stay running while the dashboard or accessories lose power?',values:['Yes','No, engine stalls','Not sure']},
   {key:'charging',title:'Have you measured voltage across the battery terminals while idling?',values:['Unmeasured','Below about 13 V','About 13.5–14.8 V','Over about 15 V']},
   {key:'repaired',title:'Were the battery or alternator recently replaced?',values:['Yes','No','Not sure']}
  ],checks:['Do not test anything while driving. Park safely and shut down if electrical or steering functions fail.','With engine OFF, visually inspect battery terminals, main grounds and belt condition.','Ask a technician to perform loaded charging-output and voltage-drop tests at the battery and alternator.','If voltage is normal, inspect power distribution, main fuses, grounds and relevant control-module codes.'],
  leads:['Low charging output or belt/alternator problem','Battery cables, engine grounds, or distribution connection','Charging-control/wiring fault or a recurring load-related problem']},
rattle:{title:'Cold-start rattle or engine noise',urgency:'Shut off the engine for deep knocking, oil-pressure warning, or rapidly worsening noise.',
 questions:[{key:'time',title:'When does the sound occur?',values:['Only first 1–3 seconds after cold start','Continuously at idle','When accelerating','Not sure']},{key:'oil',title:'Has the oil level been checked using the vehicle procedure?',values:['At recommended level','Below recommended level','Not checked']},{key:'sound',title:'Which description best fits?',values:['Metallic rattling/clacking','Ticking/tapping','Deep knocking','Squealing/whining']}],
 checks:['Check oil level and warning lights before another cold start.','Record a short cold and warm comparison, noting how long the noise persists.','Inspect external belt-driven components and exhaust leaks before assuming an internal fault.','Have oil pressure, variable valve timing operation and relevant timing components checked using vehicle service data.'],
 leads:['Oil-pressure-dependent timing actuator/tensioner or valvetrain noise','Accessory drive or exhaust-related cold-start noise','Lubrication or mechanical wear requiring inspection']},
start:{title:'No-start or slow-crank',urgency:'Avoid repeated cranking if there is smoke, strong fuel smell, or overheating.',
 questions:[{key:'crank',title:'What happens when you try to start it?',values:['No crank, only click','Cranks slowly','Cranks at normal speed but will not fire','Starts then stalls']},{key:'power',title:'Are interior and headlights visibly dim?',values:['Yes','No','Not sure']},{key:'history',title:'When was the issue first noticed?',values:['Suddenly','Gradually worsening','After a repair/battery replacement']}],
 checks:['Check battery state and terminals before replacing the starter.','If cranking is weak, test voltage under load and cable voltage drop.','If cranking is normal, scan for codes and perform qualified fuel/spark/immobilizer checks.','Look for recent work affecting connectors, grounds and fuses.'],
 leads:['Weak battery or high-resistance electrical connection','Starter circuit or relay problem','Fuel, spark, immobilizer or engine-control fault (if crank speed is normal)']},
misfire:{title:'Rough running or check-engine light',urgency:'A flashing check-engine light can mean catalyst-damaging misfires. Safely stop and arrange diagnosis.',
 questions:[{key:'light',title:'Is the check-engine light flashing or steady?',values:['Flashing','Steady','No light','Not sure']},{key:'symptom',title:'When is the engine rough?',values:['Idle','Acceleration/load','All the time','Only cold']},{key:'codes',title:'Have you read the exact OBD trouble codes?',values:['Yes, I have codes','No','Scanner cannot connect']}],
 checks:['Record stored/pending codes and freeze-frame data rather than clearing them.','Identify whether misfires affect one cylinder or several.','Review fuel trims and visually check for intake leaks and damaged ignition connectors.','Verify ignition, fuel delivery and compression before ordering parts.'],
 leads:['Ignition components or fuel injector performance','Air leak or fuel-mixture issue','Mechanical cylinder or sensor/control problem']},
brakes:{title:'Brake noise or poor braking',urgency:'Do not drive with a sinking pedal, brake-fluid leak, severely weak braking or unstable steering.',
 questions:[{key:'pedal',title:'Is brake pedal effort/feel normal?',values:['Normal','Spongy/sinking','Very hard','Not sure']},{key:'issue',title:'What is the main symptom?',values:['Grinding','Squealing','Pulls to one side','Vibration when braking']},{key:'fluid',title:'Any visible fluid leak or brake warning light?',values:['Yes','No','Not checked']}],
 checks:['If braking is impaired or fluid is leaking, arrange towing and professional inspection.','Inspect pad/rotor condition, calipers, and wheel hardware with safe support.','Check for brake and ABS fault codes as applicable.','Avoid brake-line, ABS hydraulic or high-voltage system repair without qualified equipment.'],
 leads:['Worn pads/rotors or caliper hardware','Hydraulic/ABS concern depending on pedal feel','Tire, suspension, or wheel issue contributing to vibration']},
cooling:{title:'Overheating or coolant warning',urgency:'Stop as soon as safe if overheating. Do not open a hot cooling-system cap.',
 questions:[{key:'temp',title:'When does the temperature rise?',values:['At idle','At highway speed','Both','Only after parking']},{key:'leak',title:'Any signs of coolant leak?',values:['Yes','No','Not checked']},{key:'fan',title:'Are radiator/cooling fans working when commanded?',values:['Yes','No','Unknown']}],
 checks:['Shut down safely if overheating; allow the system to cool completely.','Visually inspect for coolant leaks and low reservoir level only when safe.','Have cooling pressure, fan commands, thermostat, and pump flow checked.','Check for combustion-gas intrusion only if other tests warrant it.'],
 leads:['Loss of coolant or external leak','Cooling fan/thermostat/water-pump fault','Restriction or internal sealing issue']},
transmission:{title:'Transmission slipping or shift concern',urgency:'Avoid driving if gear engagement is lost or the vehicle moves unpredictably.',
 questions:[{key:'gear',title:'Which symptom is most noticeable?',values:['Slips and engine revs','Hard/late shifts','Will not engage drive/reverse','Whining or grinding']},{key:'temp',title:'Is the problem temperature-dependent?',values:['Mostly cold','Mostly hot','Both','Not sure']},{key:'fluid',title:'Does the transmission fluid look burnt or leak?',values:['Burnt smell','Visible leak','Looks normal','Not checked']}],
 checks:['Stop driving if severe slipping or loss of engagement occurs.','Verify the correct transmission fluid and level procedure for the exact model.','Read transmission-control codes and live input/output speed data.','Consider fluid-pressure and mechanical tests with a transmission specialist.'],
 leads:['Fluid level/pressure or hydraulic control issue','Shift solenoid/control/speed sensor','Internal clutch or gear damage']},
ac:{title:'Air conditioner not cooling',urgency:'Low urgency unless defogging/visibility is impaired.',
 questions:[{key:'blower',title:'Does air blow normally from the vents?',values:['Yes','No','Only some speeds']},{key:'speed',title:'When is cooling weakest?',values:['At idle','While driving','Always']},{key:'repair',title:'Has any A/C component been replaced recently?',values:['Yes','No']}],
 checks:['Check cabin blower operation, air-routing controls and condenser fan activity.','Check vent air temperature under consistent conditions.','Have refrigerant pressures and electrical commands checked by a qualified technician.','Do not vent refrigerant or add refrigerant blindly.'],
 leads:['Low refrigerant due to a leak','Condenser fan or compressor-control fault','Air-mix door or blower/airflow fault']}
};
let type='',answers={},doneChecks={};
const label=(text,cls='')=>'<span class="'+cls+'">'+esc(text)+'</span>';
function render(){
 const div=by('wizardApp');if(!div)return;
 if(!type){div.innerHTML='<div class="wizard-grid">'+Object.entries(CHOICES).map(([key,c])=>
 '<button class="wizard-topic" data-topic="'+key+'"><span class="wizard-symbol">+</span><strong>'+esc(c.title)+'</strong><small>Start troubleshooting</small></button>').join('')+'</div>';
 div.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{type=b.dataset.topic;answers={};doneChecks={};render();}));return;}
 const c=CHOICES[type];div.innerHTML='<div class="wizard-head"><button type="button" class="outline-btn" id="wizardBack">← All problems</button><span class="tag">OFFLINE DIAGNOSTIC WORKFLOW</span></div>'+
 '<h2 class="wizard-title">'+esc(c.title)+'</h2><p class="wizard-warning">'+esc(c.urgency)+'</p>'+
 '<div class="wizard-panel"><h3>Describe what you observed</h3>'+c.questions.map(q=>
 '<div class="wizard-question"><strong>'+esc(q.title)+'</strong><div class="wizard-answers">'+q.values.map(v=>'<button data-question="'+esc(q.key)+'" data-answer="'+esc(v)+'" class="wizard-answer'+(answers[q.key]===v?' selected':'')+'">'+esc(v)+'</button>').join('')+'</div></div>').join('')+'</div>'+
 '<div class="wizard-panel"><h3>Likely systems to investigate—not confirmed failures</h3><ol>'+c.leads.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ol><div class="wizard-observations">'+
 c.questions.filter(q=>answers[q.key]).map(q=>'<p><b>'+esc(q.title)+'</b> '+esc(answers[q.key])+'</p>').join('')+'</div></div>'+
 '<div class="wizard-panel"><h3>Tests and checks before buying parts</h3><div class="wizard-checklist">'+c.checks.map((t,i)=>'<label><input type="checkbox" data-check="'+i+'" '+(doneChecks[i]?'checked':'')+'><span>'+esc(t)+'</span></label>').join('')+'</div></div>'+
 '<div class="wizard-panel"><label for="wizardNotes"><strong>Actual test results and notes</strong></label><textarea id="wizardNotes" rows="3" class="field" placeholder="Measurements, codes, when it happens, repairs already tried…">'+esc(answers.notes||'')+'</textarea>'+
 '<div class="wizard-actions"><button class="primary-btn" id="saveWizard">Save diagnostic report</button><button class="outline-btn" id="askWizard">Discuss with assistant</button><button class="outline-btn" id="exportWizard">Download report</button></div></div>';
 by('wizardBack').onclick=()=>{type='';render()};
 div.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{answers[b.dataset.question]=b.dataset.answer;const notes=by('wizardNotes')?.value||'';answers.notes=notes;render();});
 div.querySelectorAll('[data-check]').forEach(b=>b.onchange=()=>{doneChecks[b.dataset.check]=b.checked;});
 by('wizardNotes').oninput=e=>answers.notes=e.target.value;
 by('saveWizard').onclick=()=>saveReport(false);
 by('exportWizard').onclick=()=>exportReport();
 by('askWizard').onclick=()=>{if(window.RavrentApp?.openChatWithQuestion)window.RavrentApp.openChatWithQuestion(summary());else alert('Chat is unavailable. Download the guided report instead.');};
}
function summary(){
 if(!type)return'';
 const c=CHOICES[type];
 return 'Please help me interpret this guided diagnostic. My issue: '+c.title+'.\n'+
 c.questions.filter(q=>answers[q.key]).map(q=>q.title+' '+answers[q.key]).join('\n')+
 '\nChecks completed: '+c.checks.filter((_,i)=>doneChecks[i]).join('; ')+
 '\nMy measurements/notes: '+(answers.notes||'Not supplied')+
 '\nCompare possible causes and recommend the next *safe* diagnostic test before replacing parts. Do not claim any result was verified.';
}
function saveReport(download){
 if(!type)return;
 const c=CHOICES[type],entry={id:'guided-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
 date:new Date().toISOString(),vehicle:'Guided diagnostics',summary:c.title,
 messages:[{role:'user',text:summary()},{role:'assistant',text:'OFFLINE WORKFLOW — not an AI diagnosis.\n\nPossible systems:\n'+c.leads.map((x,i)=>(i+1)+'. '+x).join('\n')+
 '\n\nRecommended checks:\n'+c.checks.map((x,i)=>(doneChecks[i]?'[COMPLETE] ':'[ ] ')+x).join('\n')}]
 };
 if(!window.RavrentApp?.addGuidedReport?.(entry)){alert('Could not save to reports. Use Download report instead.');return;}
 alert('Saved under Saved Reports.');
}
function exportReport(){
 const b=new Blob([summary()+'\n\nPossible systems:\n'+CHOICES[type].leads.join('\n')+'\n\nChecks:\n'+CHOICES[type].checks.map((x,i)=>(doneChecks[i]?'[x] ':'[ ] ')+x).join('\n')+
 '\n\nThis is a general guided checklist, not a confirmed diagnosis.'],{type:'text/plain'});
 const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='ravrent-diagnostic-checklist.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const aiStatusKey='ravrent_ai_last_status';
function updateAIState(ok,code,message){
 const heading=by('aiConnectionHeadline'),detail=by('aiConnectionDetail'),dot=by('aiStateDot');
 if(heading)heading.textContent=ok?'AI connected':code==='TESTING'?'Checking AI connection…':code==='UNVERIFIED'?'AI connection not verified':'AI connection unavailable';
 if(detail)detail.textContent=message||'Run a live test to verify whether the provider can answer.';
 if(dot)dot.className='health-dot '+(ok?'status-ok':code==='TESTING'?'status-working':code==='UNVERIFIED'?'status-unknown':'status-fail');
 const header=by('connection');
 if(header){header.textContent=ok?'AI connected':code==='UNVERIFIED'?'AI not tested':'AI offline';header.classList.toggle('ready',ok);header.classList.toggle('warning',!ok);}
 if(code!=='TESTING'&&code!=='UNVERIFIED'){try{localStorage.setItem(aiStatusKey,JSON.stringify({ok,code,message,time:Date.now()}))}catch{}}
}
function healthRow(name,message,state){
 return '<div class="health-row"><span>'+esc(name)+'</span><small class="'+(state==='ok'?'health-ok':state==='fail'?'health-fail':'')+'">'+esc(message)+'</small></div>'
}
async function runChecks(){
 const box=by('healthResults');if(!box)return;
 box.innerHTML=healthRow('App checks','Checking…','neutral');
 const lines=[];
 try{
  const test='ravrent-storage-check';localStorage.setItem(test,'ok');
  const working=localStorage.getItem(test)==='ok';localStorage.removeItem(test);
  lines.push(healthRow('Local records',working?'Available on this device':'Storage is blocked',''+(working?'ok':'fail')));
 }catch{lines.push(healthRow('Local records','Storage is unavailable','fail'))}
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  let response;try{response=await fetch('/api/health',{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  const ok=data.server==='online';
  lines.push(healthRow('Application server',ok?'Responding':'Service not responding as expected',ok?'ok':'fail'));
  lines.push(healthRow('AI provider',data.assistant==='paused_by_owner'?'Paused by owner':data.assistant==='configured_unverified'?'Key installed; needs a live test':'No verified connection','neutral'));
 }catch{lines.push(healthRow('Application server','Unable to reach server','fail'))}
 lines.push(healthRow('Offline guided diagnostics','Available without AI','ok'));
 box.innerHTML=lines.join('');
}
async function checkProvider(){
 const button=by('checkProvider'),out=by('providerCheckResult');
 if(!button||!out)return;
 button.disabled=true;out.textContent='Inspecting provider permissions…';
 try{
  const response=await fetch('/api/provider-check',{cache:'no-store'}),data=await response.json();
  if(!response.ok)throw Error(data.error||'HTTP '+response.status);
  if(data.status==='provider_access_ok'){
   const matching=data.standardModelListed&&data.deepModelListed;
   out.textContent='Google accepted model listing. '+(matching?'Both configured models are listed.':'At least one configured model is not available.')+' Run Test AI connection to verify actual generation.';
   let recentSuccess=false;try{const saved=JSON.parse(localStorage.getItem(aiStatusKey)||'null');recentSuccess=!!saved?.ok&&Number.isFinite(saved.time)&&Date.now()-saved.time<10*60*1000}catch{}
   if(!recentSuccess)updateAIState(false,'UNVERIFIED','Google permits model listing, but a successful AI response has not been demonstrated.');
  }else{
   const message=data.message||'Provider access failed.';
   out.textContent=(data.code||'PROVIDER')+': '+message;
   updateAIState(false,data.code||'AI_PROVIDER',message);
  }
 }catch(e){out.textContent='Could not check provider: '+e.message;updateAIState(false,'PROVIDER_NETWORK','Could not reach provider test.')}
 finally{button.disabled=false}
}
async function liveTest(){
 const button=by('runLiveAiTest'),out=by('liveAiTestResult');
 if(!button||!out)return;
 button.disabled=true;out.textContent='Requesting a real AI response…';
 updateAIState(false,'TESTING','Checking a real Gemini reply.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
   signal:controller.signal,body:JSON.stringify({messages:[{role:'user',text:'Reply with exactly: Diagnostic connection working.'}],deep:false,research:false})});
  const data=await response.json().catch(()=>({}));
  if(response.ok&&typeof data.reply==='string'&&data.reply.trim()){
   out.textContent='Live AI reply received. The diagnostic assistant is responding.';
   updateAIState(true,'CONNECTED','Google returned a real generated response. Camera/media functions require separate tests.');
  }else{
   const message=data.error||'No AI response returned.';
   out.textContent=(data.code||'REQUEST_FAILED')+' — '+message;
   updateAIState(false,data.code||'REQUEST_FAILED',message);
   const advanced=by('healthAdvanced');if(advanced)advanced.open=true;
  }
 }catch(e){
  const message=controller.signal.aborted?'The AI test timed out.':'Could not reach the AI test endpoint.';
  out.textContent=message;updateAIState(false,'NETWORK',message);
 }finally{clearTimeout(timer);button.disabled=false}
}
try{
 const saved=JSON.parse(localStorage.getItem(aiStatusKey)||'null');
 if(saved&&Number.isFinite(saved.time)&&Date.now()-saved.time<12*60*60*1000){
  const dot=by('aiStateDot'),header=by('connection');
  if(by('aiConnectionHeadline'))by('aiConnectionHeadline').textContent=saved.ok?'AI responded in last test':'AI connection unavailable';
  if(by('aiConnectionDetail'))by('aiConnectionDetail').textContent=saved.message||'Run Test AI connection again.';
  if(dot)dot.className='health-dot '+(saved.ok?'status-ok':'status-fail');
  if(header){header.textContent=saved.ok?'AI recently tested':'AI offline';header.classList.toggle('ready',!!saved.ok);header.classList.toggle('warning',!saved.ok)}
 }
}catch{}
const active=()=>{
 const wizard=by('wizardPane'),health=by('healthPane');
 if(wizard&&!wizard.classList.contains('hide'))render();
 if(health&&!health.classList.contains('hide')&&!health.dataset.checked){health.dataset.checked='yes';runChecks();checkProvider();}
};
document.querySelectorAll('[data-view="wizard"],[data-view="health"]').forEach(b=>b.addEventListener('click',()=>setTimeout(active,0)));
by('connection')?.addEventListener('click',()=>setTimeout(active,0));
by('runHealth')?.addEventListener('click',runChecks);
by('runLiveAiTest')?.addEventListener('click',liveTest);
by('checkProvider')?.addEventListener('click',checkProvider);
})();