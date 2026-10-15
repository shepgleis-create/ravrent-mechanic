(()=>{'use strict';
const core=window.RavrentSchedule;if(!core)return;
const $=id=>document.getElementById(id);
const KEY='ravrent_service_schedule_v1',GARAGE='ravrent-mechanic-v2',TOOLKIT='ravrent_toolkit_v1';
const read=(key,fallback)=>{try{const item=JSON.parse(localStorage.getItem(key)||'null');return item===null?fallback:item}catch{return fallback}};
const garage=read(GARAGE,{}),vehicles=Array.isArray(garage.vehicles)?garage.vehicles.filter(x=>x?.id).slice(0,150):[];
const saved=read(KEY,{});let plans=Array.isArray(saved.plans)?saved.plans.filter(x=>{try{core.makePlan(x);return true}catch{return false}}).slice(0,150):[];
let readings=saved.readings&&typeof saved.readings==='object'&&!Array.isArray(saved.readings)?{...saved.readings}:{};
let editingId=null;
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const note=s=>$('scheduleStatus').textContent=s;
const el=(tag,text,cls)=>{const obj=document.createElement(tag);if(text!==undefined)obj.textContent=String(text);if(cls)obj.className=cls;return obj};
const numeric=v=>v!==''&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=9999999;
function save(){
 try{localStorage.setItem(KEY,JSON.stringify({version:1,plans,readings}));return true}
 catch{note('Browser storage is full or blocked. Export your plans before adding more.');return false}
}
function vehicleName(v){return [v.year,v.make,v.model].filter(Boolean).join(' ')||'Vehicle'}
function currentVehicle(){return vehicles.find(v=>String(v.id)===$('scheduleVehicle').value)}
function currentMiles(id){const v=vehicles.find(x=>String(x.id)===String(id));const raw=Object.prototype.hasOwnProperty.call(readings,id)?readings[id]:v?.miles;return numeric(raw)?Math.round(Number(raw)):null}
function reportStatus(){const combined=Object.fromEntries(vehicles.map(v=>[String(v.id),currentMiles(v.id)]));const sums=core.summarize(plans,combined,today());
 for(const [kind,id] of [['due','scheduleDue'],['soon','scheduleSoon'],['scheduled','scheduleScheduled'],['completed','scheduleCompleted']])$(id).textContent=String(sums[kind])}
function formData(){
 return {id:editingId||'',vehicleId:$('scheduleVehicle').value,
  name:$('scheduleName').value,dueMileage:$('scheduleDueMiles').value,
  dueDate:$('scheduleDueDate').value,intervalMiles:$('scheduleEveryMiles').value,
  intervalMonths:$('scheduleEveryMonths').value,notes:$('scheduleNotes').value};
}
function clearForm(){
 editingId=null;
 for(const id of ['scheduleName','scheduleDueMiles','scheduleDueDate','scheduleEveryMiles','scheduleEveryMonths','scheduleNotes'])$(id).value='';
 $('saveSchedule').textContent='Add service plan';
}
function showPlan(plan){
 editingId=plan.id;
 $('scheduleVehicle').value=plan.vehicleId;
 $('scheduleName').value=plan.name;
 $('scheduleDueMiles').value=plan.dueMileage??'';
 $('scheduleDueDate').value=plan.dueDate||'';
 $('scheduleEveryMiles').value=plan.intervalMiles??'';
 $('scheduleEveryMonths').value=plan.intervalMonths??'';
 $('scheduleNotes').value=plan.notes||'';
 $('saveSchedule').textContent='Save changes';
 $('scheduleName').focus();
}
function render(){
 const selected=$('scheduleVehicle').value;
 const vehicle=currentVehicle();
 $('scheduleMileage').value=vehicle&&currentMiles(selected)!==null?String(currentMiles(selected)):'';
 reportStatus();
 const host=$('scheduleList');host.replaceChildren();
 const scoped=plans.filter(x=>x.vehicleId===selected).sort((a,b)=>{
  const rank={due:0,soon:1,scheduled:2,completed:3};
  const aRank=rank[core.dueStatus(a,currentMiles(selected),today()).status],bRank=rank[core.dueStatus(b,currentMiles(selected),today()).status];
  return aRank-bRank||String(a.name).localeCompare(String(b.name));
 });
 if(!vehicle){host.append(el('p','Add a vehicle in My Garage to create mileage-based service reminders.','schedule-hint'));return}
 if(!scoped.length){host.append(el('p','No service reminders for this vehicle yet. Add the next known maintenance task above.','schedule-hint'));return}
 for(const plan of scoped){
  const condition=core.dueStatus(plan,currentMiles(selected),today());
  const row=el('article',undefined,'schedule-record '+condition.status);
  const title=el('div',undefined,'schedule-record-head');
  title.append(el('strong',plan.name),el('span',({due:'Due now',soon:'Due soon',scheduled:'Scheduled',completed:'Completed'})[condition.status],'schedule-indicator'));
  row.append(title);
  const detail=[plan.dueMileage?'At '+plan.dueMileage.toLocaleString('en-US')+' miles':'',plan.dueDate?'By '+plan.dueDate:'',
   condition.remainingMiles!==null&&!plan.completed?'Mileage remaining: '+condition.remainingMiles.toLocaleString('en-US'):'',
   condition.remainingDays!==null&&!plan.completed?'Days remaining: '+condition.remainingDays:''].filter(Boolean).join(' · ');
  if(detail)row.append(el('p',detail,'schedule-detail'));
  if(plan.notes)row.append(el('p',plan.notes,'schedule-hint'));
  const latest=Array.isArray(plan.history)?plan.history.at(-1):null;
  if(latest)row.append(el('small','Last recorded service: '+latest.date+' at '+latest.miles.toLocaleString('en-US')+' miles · $'+Number(latest.cost||0).toFixed(2),'schedule-last'));
  const actions=el('div',undefined,'case-actions');
  const edit=el('button','Edit'),remove=el('button','Delete'),complete=el('button',plan.completed?'Record another service':'Record completed service');
  edit.type=remove.type=complete.type='button';
  edit.onclick=()=>{showPlan(plan);note('Editing '+plan.name+'. Save changes after verifying the schedule.')};
  remove.onclick=()=>{if(!confirm('Delete this service reminder and its completion history?'))return;
   const before=plans;plans=plans.filter(x=>x.id!==plan.id);if(!save())plans=before;else{render();note('Service plan deleted.')}}
  const completion=el('div',undefined,'schedule-completion');
  const dateLabel=el('label','Date performed'),date=el('input');date.type='date';date.value=today();dateLabel.append(date);
  const milesLabel=el('label','Odometer when performed'),miles=el('input');miles.type='number';miles.min='0';miles.max='9999999';miles.inputMode='numeric';miles.value=currentMiles(selected)??'';miles.placeholder='Actual mileage';milesLabel.append(miles);
  const costLabel=el('label','Paid ($), optional'),cost=el('input');cost.type='number';cost.min='0';cost.max='1000000';cost.step='.01';cost.value='0';costLabel.append(cost);
  const confirm=el('button','Save completed service'),cancel=el('button','Cancel');confirm.type=cancel.type='button';confirm.className='schedule-complete-button';cancel.className='secondary';
  completion.append(dateLabel,milesLabel,costLabel,confirm,cancel);completion.hidden=true;
  complete.onclick=()=>{completion.hidden=false;miles.focus()};
  cancel.onclick=()=>{completion.hidden=true};
  confirm.onclick=()=>{
   if(!numeric(miles.value)){note('Enter the actual odometer reading recorded when service was performed.');return}
   let updated;try{updated=core.markCompleted(plan,{completedMiles:miles.value,completedDate:date.value,cost:cost.value})}
   catch(e){note(e.message);return}
   const previous=plans,priorReadings={...readings};
   plans=plans.map(p=>p.id===plan.id?updated:p);
   const newMileage=Number(miles.value);if(currentMiles(selected)===null||newMileage>currentMiles(selected))readings[selected]=newMileage;
   if(!save()){plans=previous;readings=priorReadings;return}
   try{
    const logs=read(TOOLKIT,{}),history=Array.isArray(logs.services)?logs.services:[];
    logs.services=[{vehicle:vehicleName(vehicle),service:plan.name,date:date.value,miles:newMileage,
      next:updated.dueMileage||0,cost:Number(cost.value||0)},...history].slice(0,250);
    localStorage.setItem(TOOLKIT,JSON.stringify(logs));
    note('Actual completed service saved to this schedule and Ownership Toolkit.')
   }catch{note('Service completion saved here; Ownership Toolkit could not be updated. Export your plans for backup.')}
   render()
  };
  actions.append(edit,complete,remove);row.append(actions,completion);host.append(row)
 }
}
function download(filename,contents,mime){
 const blob=new Blob([contents],{type:mime}),url=URL.createObjectURL(blob),a=el('a');
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
const selector=$('scheduleVehicle');selector.replaceChildren();
selector.append(new Option(vehicles.length?'Choose a garage vehicle':'No garage vehicles on this browser',''));
for(const v of vehicles)selector.append(new Option(vehicleName(v),String(v.id)));
if(vehicles.length)selector.value=String(vehicles[0].id);
selector.addEventListener('change',()=>{clearForm();render()});
$('saveMileage').addEventListener('click',()=>{
 const vehicle=currentVehicle(),value=$('scheduleMileage').value;
 if(!vehicle||!numeric(value)){note('Select a garage vehicle and enter its actual observed odometer mileage.');return}
 const previous=readings[vehicle.id];readings[vehicle.id]=Math.round(Number(value));
 if(!save()){if(previous===undefined)delete readings[vehicle.id];else readings[vehicle.id]=previous;return}
 render();note('Observed mileage saved locally. Service status recalculated from your entry.')
});
$('saveSchedule').addEventListener('click',()=>{
 if(!currentVehicle()){note('Choose a garage vehicle first.');return}
 let normalized;try{normalized=core.makePlan(formData())}catch(e){note(e.message);return}
 if(plans.length>=150&&!editingId){note('Plan limit reached (150). Delete outdated plans or export a backup.');return}
 if(!normalized.id)normalized.id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'service-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const old=plans,original=plans.find(p=>p.id===editingId);
 normalized.history=original?.history||[];normalized.completed=original?.completed||false;
 plans=editingId?plans.map(p=>p.id===editingId?normalized:p):[normalized,...plans];
 if(!save()){plans=old;return}
 clearForm();render();note('Service reminder saved. It uses only mileage and dates you entered.')
});
$('exportSchedule').addEventListener('click',()=>download('ravrent-service-plans.json',JSON.stringify({app:'ravrent-mechanic',format:'maintenance-plans',version:1,exported:today(),plans,readings},null,2),'application/json'));
$('importSchedule').addEventListener('click',()=>$('importScheduleFile').click());
$('importScheduleFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 if(file.size>1024*1024){note('Backup is too large; the supported limit is 1 MB.');return}
 let backup;try{backup=JSON.parse(await file.text());if(backup.app!=='ravrent-mechanic'||backup.format!=='maintenance-plans'||!Array.isArray(backup.plans)||backup.plans.length>150)throw Error('Not a Ravrent service-plan backup.')}
 catch(e){note(e.message||'Could not read backup.');return}
 const known=new Set(plans.map(x=>x.id));
 let restored=[];try{restored=backup.plans.map(core.makePlan).filter(x=>x.id&&!known.has(x.id));if(restored.length+plans.length>150)throw Error('Restore would exceed 150 plans.')}
 catch(e){note(e.message);return}
 if(!restored.length){note('All plans in this backup already exist. Existing mileage records were left unchanged.');return}
 if(!confirm('Restore '+restored.length+' additional maintenance plans? Existing plans will be preserved.'))return;
 const old=plans,oldReadings={...readings},incoming=backup.readings&&typeof backup.readings==='object'&&!Array.isArray(backup.readings)?backup.readings:{};
 plans=[...restored,...old];
 for(const v of vehicles){
  const id=String(v.id);
  if(Object.prototype.hasOwnProperty.call(readings,id))continue;
  if(Object.prototype.hasOwnProperty.call(incoming,id)&&numeric(incoming[id]))readings[id]=Math.round(Number(incoming[id]));
 }
 if(!save()){plans=old;readings=oldReadings}
 else{render();note('Restored '+restored.length+' plans and missing mileage readings without replacing existing data.')}
});
$('exportCalendar').addEventListener('click',()=>{
 const selected=plans.filter(p=>p.vehicleId===$('scheduleVehicle').value&&p.dueDate&&!p.completed);
 if(!selected.length){note('Add a due date to an active service plan before exporting calendar reminders.');return}
 download('ravrent-service-reminders.ics',core.calendarICS(selected),'text/calendar;charset=utf-8');
 note('Calendar file prepared. Import it into your calendar; automatic future updates are not connected.')
});
render();
})();