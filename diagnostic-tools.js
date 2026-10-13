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
 leads:['Low refrigerant due to a leak','Condenser fan or compressor-control fault','Air-mix door or blower/airflow fault']},
suspension:{"title":"Suspension knocks or clunks","urgency":"Stop and inspect professionally if steering is loose, a wheel shifts, or the car will not track straight.","questions":[{"key":"when","title":"When do you hear the clunk?","values":["Over small bumps","While turning","Braking/accelerating","All driving"]},{"key":"location","title":"Where does it seem to come from?","values":["Front","Rear","Unknown"]},{"key":"steer","title":"Any steering instability?","values":["Yes","No","Not sure"]}],"checks":["Look for obvious damage, uneven tire wear or leaking dampers without crawling beneath an unsupported vehicle.","Reproduce the noise only at low safe speed if handling remains normal.","Have ball joints, control arms, strut mounts, sway links and bushings checked under correct loading.","Verify wheel fastener torque by qualified service information."],"leads":["Worn suspension joint, bushing or link","Strut mount or damper issue","Loose or damaged wheel/steering component"]},
vibration:{"title":"Highway vibration or wheel shake","urgency":"Avoid driving at speed if vibration becomes severe, a tire bulge is visible or a wheel appears loose.","questions":[{"key":"when","title":"When is vibration strongest?","values":["At a fixed road speed","During braking","During acceleration","At idle"]},{"key":"where","title":"Where is it felt?","values":["Steering wheel","Seat/body","Brake pedal"]},{"key":"recent","title":"Recent tire, wheel or brake repair?","values":["Yes","No","Unknown"]}],"checks":["Inspect tires for damage and inflation pressure when parked.","Document speed range and whether braking or acceleration changes the vibration.","Ask for road-force tire balancing and wheel runout checks where indicated.","Consider hubs, driveshaft/CV joints, brake rotors and suspension only after tire causes are evaluated."],"leads":["Tire/wheel imbalance, deformation or mounting issue","Brake rotor or caliper concern","CV axle, driveline or hub issue"]},
batteryDrain:{"title":"Battery dies while parked","urgency":"A swollen, smoking or overheating battery requires professional handling and immediate avoidance of ignition sources.","questions":[{"key":"time","title":"How quickly does it die?","values":["Overnight","After days","After several weeks"]},{"key":"recent","title":"Any recent electrical repair or accessories?","values":["Yes","No"]},{"key":"age","title":"Has the battery been load-tested?","values":["Passed","Failed","Not tested"]}],"checks":["Document the parked period and whether interior lights or aftermarket equipment remain active.","Verify battery condition and charging supply before searching for parasitic draw.","A technician should measure sleep-current after modules have shut down.","Investigate stuck relays, aftermarket wiring and modules only when testing shows an abnormal draw."],"leads":["Weak battery or charging deficiency","Parasitic accessory or control-module load","Terminal or connection issue"]},
lean:{"title":"Lean codes P0171 / P0174","urgency":"Stop for severe loss of power, flashing check-engine lamp, strong fuel smell or unstable engine operation.","questions":[{"key":"load","title":"When is the problem worse?","values":["Idle","Acceleration","All driving","No symptoms"]},{"key":"codes","title":"Are lean codes affecting both banks?","values":["One bank","Both banks","Not sure"]},{"key":"work","title":"Recent intake or sensor work?","values":["Yes","No"]}],"checks":["Record fuel trims, freeze frame and companion codes before clearing them.","Inspect intake ducts, vacuum hoses and obvious unmetered air paths safely.","A qualified technician should verify fuel pressure, MAF/MAP measurements and exhaust leaks.","Compare idle and loaded fuel trims before buying oxygen sensors."],"leads":["Unmetered intake air or PCV leak","MAF sensing or fuel supply issue","Exhaust leak or bank-specific issue"]},
oilUse:{"title":"Oil consumption or engine oil leaks","urgency":"Stop if oil pressure warning appears, oil is leaking onto hot exhaust or oil level falls rapidly.","questions":[{"key":"symptom","title":"Which issue is present?","values":["Oil level drops","Visible drips","Smoke from exhaust","Oil smell"]},{"key":"mileage","title":"How fast does the oil level change?","values":["Within days","Over thousands of miles","Not measured"]},{"key":"repair","title":"Any recent gasket or engine work?","values":["Yes","No"]}],"checks":["Measure oil level consistently using the vehicle procedure and record mileage.","Check visible engine/exhaust areas for signs of fresh oil without touching hot parts.","Have leaks traced before using sealants or altering viscosity.","If no external leak is found, consider PCV, valve-stem, ring or turbo diagnosis with proper measurements."],"leads":["Gasket or seal leak","PCV or oil-separation fault","Internal oil consumption requiring testing"]},
smoke:{"title":"White, blue or black exhaust smoke","urgency":"Stop for heavy smoke, strong fuel smell, overheating or rapid fluid loss.","questions":[{"key":"color","title":"What color is the smoke?","values":["White","Blue/gray","Black","Hard to tell"]},{"key":"timing","title":"When does it appear?","values":["Only at cold start","During acceleration","Constantly"]},{"key":"fluids","title":"Any oil or coolant loss?","values":["Oil","Coolant","Neither known"]}],"checks":["Record ambient conditions and whether vapor clears after warm-up.","Check engine oil and coolant levels safely when cooled.","Ask a technician for fuel-control checks or cooling pressure testing as appropriate.","Do not conclude head-gasket failure from white cold-start vapor alone."],"leads":["Normal condensation or coolant intrusion","Oil entering combustion/exhaust","Overly rich mixture or injector problem"]},
abs:{"title":"ABS or stability-control warning","urgency":"If braking or steering behaves abnormally, stop safely and arrange a tow or inspection.","questions":[{"key":"lights","title":"Which warning appears?","values":["ABS only","Traction/stability only","Brake system warning too"]},{"key":"pedal","title":"How does the brake pedal feel?","values":["Normal","Soft/sinking","Hard/abnormal"]},{"key":"recent","title":"Recent wheel, tire or suspension work?","values":["Yes","No"]}],"checks":["Do not intentionally test ABS on public roads.","Record warning timing and any wheel-speed/ABS module codes with a capable scanner.","Inspect tire size consistency and visible sensor wiring for damage.","Have braking hydraulics, wheel speed signals and module supply tested before parts replacement."],"leads":["Wheel-speed sensor or tone ring issue","Voltage/power supply to ABS module","Hydraulic or brake-control concern"]},
vvt:{"title":"Camshaft position or VVT faults","urgency":"Stop if the engine misfires severely, loses oil pressure or makes sustained mechanical knocking.","questions":[{"key":"code","title":"What code family is stored?","values":["Cam position circuit","Cam timing performance","Crank/cam correlation","Not sure"]},{"key":"start","title":"When does it happen?","values":["Only cold start","While driving","After sensor replacement"]},{"key":"oil","title":"Oil maintenance status?","values":["Correct oil and level","Low or overdue","Unknown"]}],"checks":["Record exact manufacturer-specific code and bank/sensor designation.","Inspect sensor connectors, grounds, supply and signal wiring before changing a component.","Verify oil level, approved viscosity and VVT control commands.","Timing correlation and actuator faults need appropriate scope/scan data; do not rely on a code name alone."],"leads":["Sensor circuit or harness issue","Oil-control solenoid or timing actuator","Mechanical timing/correlation problem"]},
exhaust:{"title":"Exhaust leak or catalyst-efficiency code","urgency":"Strong exhaust fumes entering the cabin require stopping use because of carbon monoxide risk.","questions":[{"key":"sound","title":"What is the main clue?","values":["Ticking leak noise","P0420/P0430 code","Strong exhaust smell","Rattle under car"]},{"key":"conditions","title":"When is it strongest?","values":["Cold idle","Acceleration","Always"]},{"key":"codes","title":"Other engine codes?","values":["Misfire/fuel trim","Oxygen sensor","None known"]}],"checks":["Avoid running an engine in enclosed areas.","Record freeze-frame data and any upstream engine codes first.","Have exhaust joints, upstream leaks and catalyst efficiency tested using appropriate equipment.","Do not remove or bypass legally required emissions equipment."],"leads":["Exhaust gasket, flex pipe or joint leak","Engine mixture/misfire causing catalyst-monitor fault","Catalytic converter or sensor problem requiring testing"]},
steering:{"title":"Power steering or unstable steering","urgency":"Sudden heavy steering, binding or unpredictable tracking can be dangerous; stop safely and arrange a tow.","questions":[{"key":"symptom","title":"What changed?","values":["Steering becomes heavy","Fluid or whining noise","Vehicle pulls or wanders","Clunk while turning"]},{"key":"speed","title":"When does it happen?","values":["At idle/parking","At highway speed","Intermittently"]},{"key":"warnings","title":"Any EPS or charging system lights?","values":["Yes","No","Not sure"]}],"checks":["Never test loss of assist while driving.","Inspect tires and warning lights with the vehicle stationary.","Check applicable hydraulic-fluid level only if the specific vehicle uses hydraulic assist.","Have steering rack, EPS modules, charging supply and joints checked using the correct service manual."],"leads":["Low electrical supply or EPS controller issue","Hydraulic leak/pump fault on equipped vehicles","Steering linkage or alignment problem"]},
hybrid:{"title":"Hybrid or EV warning / charging fault","urgency":"Do not open high-voltage covers, touch orange cables or attempt high-voltage battery repairs without certified training.","questions":[{"key":"warning","title":"Which warning is shown?","values":["Hybrid system warning","Traction battery warning","Will not charge","Reduced-power mode"]},{"key":"charge","title":"Which battery is affected?","values":["12V supply","Traction/high-voltage","Not known"]},{"key":"event","title":"Did this begin after a repair or weather event?","values":["After repair","After weather event","No clear event"]}],"checks":["Record exact dash warnings and manufacturer-specific trouble codes.","Verify safe 12V accessory supply only using normal owner-facing checks.","Inspect charger cable and outlet for obvious damage while disconnected.","High-voltage isolation, inverter and battery testing must be performed by qualified personnel."],"leads":["12V low-voltage or communications issue","Charging circuit or thermal-management problem","High-voltage system fault requiring certified evaluation"]},
prebuy:{"title":"Used-car pre-purchase check","urgency":"Do not buy or drive a vehicle with unresolved safety-critical braking, steering, major fluid leaks or structural damage.","questions":[{"key":"record","title":"Which records do you have?","values":["VIN and title","VIN only","No records"]},{"key":"drive","title":"Has it been independently inspected?","values":["Yes","No","Appointment booked"]},{"key":"signs","title":"Any warning lights or obvious defects?","values":["Yes","No","Not sure"]}],"checks":["Decode the VIN and compare it to the dash, door label and title.","Check title brand, lien, odometer and ownership records using approved providers; decoding a VIN is not a CARFAX report.","Obtain a VIN-specific recall check from the manufacturer or authorized portal.","Have a qualified independent pre-purchase inspection including scan and road test before agreeing to purchase."],"leads":["Undisclosed title or mileage risk","Mechanical or structural repair needs","Vehicle may be acceptable after independent verification"]},
idle:{"title":"Rough idle or stalling","urgency":"Stalling in traffic or when turning can be dangerous; avoid driving until the fault is diagnosed.","questions":[{"key":"condition","title":"When does it stall?","values":["Cold only","Warm idle","With A/C on","While driving"]},{"key":"light","title":"Any check-engine light or fault codes?","values":["Yes","No","Not scanned"]},{"key":"repair","title":"Recent battery disconnect or intake work?","values":["Yes","No"]}],"checks":["Record exact trouble codes and idle speed against vehicle specifications.","Check for obvious disconnected intake hoses and dirty airflow paths with engine off.","Compare fuel trims, throttle adaptation and charging voltage where appropriate.","Have fuel supply, sensors and mechanical operation tested if no air leak is found."],"leads":["Airflow/throttle control issue","Intake vacuum leak or incorrect mixture","Electrical supply or mechanical issue"]},
tires:{"title":"Tire-pressure alert / uneven wear","urgency":"A visibly damaged, severely underinflated or delaminated tire should not be driven.","questions":[{"key":"warning","title":"What is the warning?","values":["Low tire pressure","TPMS system fault","Rapid deflation","Uneven tire wear"]},{"key":"condition","title":"What do the tires look like?","values":["Appear normal","One tire visibly low","Sidewall damage","Not checked"]},{"key":"wheels","title":"Recent tire or wheel change?","values":["Yes","No"]}],"checks":["Check cold pressures against the vehicle door placard, not the tire sidewall maximum.","Inspect for punctures, bulges or incorrect tire sizes.","Have TPMS sensors, receiver and wheel fitment checked if pressures are correct.","Use alignment and suspension inspection to explain persistent uneven wear."],"leads":["Pressure loss or slow puncture","TPMS sensor/system fault","Alignment, rotation or suspension-related wear"]}
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
async function readProviderSetup(){
 const target=by('providerSetup');if(!target)return null;
 try{
  const response=await fetch('/api/status',{cache:'no-store'});
  if(!response.ok)throw Error('Status unavailable');
  const status=await response.json();
  if(status.setupRequired){
   target.hidden=false;
   by('providerSetupHeading').textContent='Groq is not connected';
   by('providerSetupBody').textContent='Ravrent has not received a GROQ_API_KEY for its production server. Until one is added, it still uses Gemini, which previously returned a permission error.';
  }else if(status.provider==='Groq'&&!status.configured){
   target.hidden=false;
   by('providerSetupHeading').textContent='Groq API key missing';
   by('providerSetupBody').textContent='Groq is selected but no API key is installed. Add GROQ_API_KEY in Vercel Production and redeploy.';
  }else{
   target.hidden=true;
  }
  return status;
 }catch{
  target.hidden=true;return null;
 }
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
 const selection=await readProviderSetup();
 if(selection){
  lines.push(healthRow('Active AI provider',selection.provider+(selection.configured?' · key installed, not yet verified':' · missing key'),selection.configured?'neutral':'fail'));
  if(selection.setupRequired)lines.push(healthRow('Groq open-weight AI','GROQ_API_KEY not installed in Vercel','fail'));
 }
 lines.push(healthRow('Offline guided diagnostics','Available without AI','ok'));
 box.innerHTML=lines.join('');
}
async function checkProvider(){
 const button=by('checkProvider'),out=by('providerCheckResult');
 if(!button||!out)return;
 button.disabled=true;out.textContent='Inspecting provider permissions…';await readProviderSetup();
 try{
  const response=await fetch('/api/provider-check',{cache:'no-store'}),data=await response.json();
  if(!response.ok)throw Error(data.error||'HTTP '+response.status);
  if(data.status==='provider_access_ok'){
   const matching=data.standardModelListed&&data.deepModelListed;
   out.textContent=(data.provider||'Google')+' accepted model listing. '+(matching?'Both configured models are listed.':'At least one configured model is not listed.')+' Run Test AI connection for a real answer.';
   let recentSuccess=false;try{const saved=JSON.parse(localStorage.getItem(aiStatusKey)||'null');recentSuccess=!!saved?.ok&&Number.isFinite(saved.time)&&Date.now()-saved.time<10*60*1000}catch{}
   if(!recentSuccess)updateAIState(false,'UNVERIFIED',(data.provider||'AI provider')+' permits model listing, but a real AI answer has not been verified.');
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
 updateAIState(false,'TESTING','Checking a real AI reply from the configured provider.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
   signal:controller.signal,body:JSON.stringify({messages:[{role:'user',text:'Reply with exactly: Diagnostic connection working.'}],deep:false,research:false})});
  const data=await response.json().catch(()=>({}));
  if(response.ok&&typeof data.reply==='string'&&data.reply.trim()){
   out.textContent='Live AI reply received. The diagnostic assistant is responding.';
   updateAIState(true,'CONNECTED',(data.provider||'The selected AI provider')+' returned a real generated response. Image and video features need separate verification.');
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