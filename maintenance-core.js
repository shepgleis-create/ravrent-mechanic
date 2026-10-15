(function(root){'use strict';
function asDay(value){
 if(typeof value!=='string'||!/^(19|20|21)\d\d-\d\d-\d\d$/.test(value))return null;
 const n=Date.parse(value+'T12:00:00Z'),d=new Date(n);
 return Number.isFinite(n)&&d.toISOString().slice(0,10)===value?value:null;
}
function addMonths(day,months){
 const normalized=asDay(day),count=Number(months);
 if(!normalized||!Number.isInteger(count)||count<1||count>240)throw Error('Enter a valid completion date and repeat interval in months.');
 const [y,m,d]=normalized.split('-').map(Number),start=(y*12)+(m-1)+count;
 const nextYear=Math.floor(start/12),nextMonth=start%12+1;
 const daysInMonth=new Date(Date.UTC(nextYear,nextMonth,0)).getUTCDate();
 return nextYear+'-'+String(nextMonth).padStart(2,'0')+'-'+String(Math.min(d,daysInMonth)).padStart(2,'0');
}
function finiteNumber(value,{allowEmpty=false,min=0,max=9999999}={}){
 if(value===null||value===undefined||value==='')return allowEmpty?null:0;
 const n=Number(value);
 if(!Number.isFinite(n)||n<min||n>max)throw Error('Enter a valid nonnegative mileage or interval.');
 return Math.round(n);
}
function makePlan(data){
 const name=String(data?.name||'').trim().slice(0,100),vehicleId=String(data?.vehicleId||'').slice(0,100);
 if(!name)throw Error('Enter a service or repair task name.');
 if(!vehicleId)throw Error('Choose a vehicle from My Garage.');
 const dueMileage=finiteNumber(data.dueMileage,{allowEmpty:true,max:9999999});
 const dueDate=data.dueDate?asDay(data.dueDate):null;
 if(data.dueDate&&!dueDate)throw Error('Enter a real calendar due date.');
 const intervalMiles=finiteNumber(data.intervalMiles,{allowEmpty:true,min:1,max:300000});
 const intervalMonths=finiteNumber(data.intervalMonths,{allowEmpty:true,min:1,max:240});
 if((dueMileage===null||dueMileage===0)&&!dueDate)throw Error('Enter a due mileage or due date. Do not invent OEM schedules.');
 if(intervalMiles!==null&&intervalMiles<1||intervalMonths!==null&&intervalMonths<1)throw Error('Repeat intervals must be positive.');
 return {id:String(data.id||'').slice(0,80),vehicleId,name,
  dueMileage:dueMileage||null,dueDate,intervalMiles,intervalMonths,
  notes:String(data.notes||'').trim().slice(0,600),
  completed:!!data.completed,history:Array.isArray(data.history)?data.history.slice(-30):[]};
}
function dueStatus(plan,currentMiles,today=new Date().toISOString().slice(0,10)){
 if(plan.completed)return {status:'completed',remainingMiles:null,remainingDays:null};
 const observed=finiteNumber(currentMiles,{allowEmpty:true}),mileage=plan.dueMileage;
 const remMiles=observed!==null&&mileage!==null?mileage-observed:null;
 const validToday=asDay(today);if(!validToday)throw Error('Invalid current date.');
 const due=plan.dueDate&&asDay(plan.dueDate),remainingDays=due?Math.round((Date.parse(due+'T12:00:00Z')-Date.parse(validToday+'T12:00:00Z'))/86400000):null;
 const overdue=remMiles!==null&&remMiles<=0||remainingDays!==null&&remainingDays<=0;
 const soon=remMiles!==null&&remMiles<=500||remainingDays!==null&&remainingDays<=30;
 return {status:overdue?'due':soon?'soon':'scheduled',remainingMiles:remMiles,remainingDays};
}
function markCompleted(plan,{completedMiles,completedDate,cost=0}){
 const date=asDay(completedDate);if(!date)throw Error('Choose the actual date when service was completed.');
 const miles=finiteNumber(completedMiles,{allowEmpty:false,max:9999999});
 const amount=Number(cost);if(!Number.isFinite(amount)||amount<0||amount>1000000)throw Error('Enter a valid amount paid.');
 const record={date,miles,cost:Math.round(amount*100)/100};
 const history=[...(plan.history||[]),record].slice(-30);
 const nextDueMileage=plan.intervalMiles?miles+plan.intervalMiles:null;
 if(nextDueMileage!==null&&nextDueMileage>9999999)throw Error('The next due mileage exceeds the supported range.');
 return {...plan,history,dueMileage:nextDueMileage,dueDate:plan.intervalMonths?addMonths(date,plan.intervalMonths):null,
  completed:!plan.intervalMiles&&!plan.intervalMonths};
}
function summarize(plans,readings,today){
 const result={due:0,soon:0,scheduled:0,completed:0};
 for(const p of plans){const r=dueStatus(p,readings?.[p.vehicleId],today);result[r.status]++}
 return result;
}
function calendarICS(plans){
 const events=[];
 for(const plan of plans){
  if(plan.completed||!asDay(plan.dueDate))continue;
  const subject=String(plan.name||'Vehicle service').slice(0,80).replace(/[\\;,\n\r]/g,' ');
  const uid=String(plan.id||subject).replace(/[^a-zA-Z0-9-]/g,'').slice(0,70)||'service';
  events.push(['BEGIN:VEVENT','UID:'+uid+'@ravrent-mechanic',
   'DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),
   'DTSTART;VALUE=DATE:'+plan.dueDate.replace(/-/g,''),
   'SUMMARY:'+subject,'DESCRIPTION:User-entered reminder. Verify the actual manufacturer interval and current mileage.','END:VEVENT'].join('\r\n'))
 }
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ravrent Mechanic//Local Maintenance Planner//EN','CALSCALE:GREGORIAN',...events,'END:VCALENDAR'].join('\r\n');
}
const api={asDay,addMonths,makePlan,dueStatus,markCompleted,summarize,calendarICS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.RavrentSchedule=api;
})(typeof window!=='undefined'?window:null);
