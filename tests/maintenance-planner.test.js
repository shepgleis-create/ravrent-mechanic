const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../maintenance-core');
test('maintenance plans require real garage vehicle and actual due mileage or date',()=>{
 assert.throws(()=>core.makePlan({name:'Oil change',vehicleId:'car1'}),/due mileage or due date/);
 assert.throws(()=>core.makePlan({name:'',vehicleId:'car1',dueMileage:1000}),/service or repair task/);
 assert.throws(()=>core.makePlan({name:'Brakes',vehicleId:'car1',dueDate:'2026-02-31'}),/real calendar/);
 assert.throws(()=>core.makePlan({name:'Filter',vehicleId:'car1',dueMileage:-8}),/nonnegative/);
 const p=core.makePlan({id:'demo',name:'Brake inspection',vehicleId:'car1',dueMileage:160000,intervalMiles:12000,notes:'Owner chosen interval'});
 assert.equal(p.dueMileage,160000);assert.equal(p.completed,false);
});
test('due service status uses manual odometer and entered dates, not invented OEM service data',()=>{
 const plan=core.makePlan({id:'a',name:'Cabin filter',vehicleId:'car1',dueMileage:160000,dueDate:'2026-11-20'});
 assert.equal(core.dueStatus(plan,159000,'2026-10-14').status,'scheduled');
 assert.equal(core.dueStatus(plan,159550,'2026-10-14').status,'soon');
 assert.equal(core.dueStatus(plan,160010,'2026-10-14').status,'due');
 assert.equal(core.dueStatus(plan,null,'2026-11-20').status,'due');
 assert.equal(core.dueStatus(plan,null,'2026-11-05').status,'soon');
});
test('service completion records actual work, rolls correct mileage and calendar months',()=>{
 const original=core.makePlan({id:'a',name:'Inspection',vehicleId:'car1',dueMileage:160000,intervalMiles:5000,dueDate:'2026-01-31',intervalMonths:1});
 const next=core.markCompleted(original,{completedMiles:159750,completedDate:'2026-01-31',cost:125.75});
 assert.equal(next.dueMileage,164750);assert.equal(next.dueDate,'2026-02-28');
 assert.equal(next.history[0].miles,159750);assert.equal(next.history[0].cost,125.75);
 assert.equal(next.completed,false);
 assert.equal(core.addMonths('2024-01-31',1),'2024-02-29');
 assert.equal(core.dueStatus(next,159750,'2026-02-01').status,'soon');
 const oneTime=core.markCompleted(core.makePlan({name:'One-time repair',vehicleId:'car1',dueDate:'2026-10-14'}),{completedMiles:45000,completedDate:'2026-10-14',cost:300});
 assert.equal(oneTime.completed,true);
 assert.equal(core.dueStatus(oneTime,45000,'2026-10-15').status,'completed');
});
test('calendar export is standards-shaped, includes due date only, and never invents notifications',()=>{
 const active=core.makePlan({id:'job-1',name:'Timing check',vehicleId:'car1',dueDate:'2026-12-25'});
 const noDate=core.makePlan({id:'job-2',name:'Oil change',vehicleId:'car1',dueMileage:170000});
 const file=core.calendarICS([active,noDate]);
 assert.match(file,/BEGIN:VCALENDAR/);assert.match(file,/DTSTART;VALUE=DATE:20261225/);
 assert.ok((file.match(/BEGIN:VEVENT/g)||[]).length===1);
 assert.doesNotMatch(file,/DTSTART;VALUE=DATE:170000/);
});
test('untrusted backup service completion history is validated before import',()=>{
 assert.throws(()=>core.makePlan({name:'Filter',vehicleId:'car1',dueMileage:10000,history:[{date:'bad',miles:1,cost:10}]}),/Invalid service completion date/);
 assert.throws(()=>core.makePlan({name:'Filter',vehicleId:'car1',dueMileage:10000,history:[{date:'2026-01-01',miles:1,cost:-2}]}),/Invalid service cost/);
});
test('Vehicle Health Center links its planner and garage repair-case AI without sending automatically',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','health-center.html'),'utf8');
 const ui=fs.readFileSync(path.join(__dirname,'..','maintenance-planner.js'),'utf8');
 const health=fs.readFileSync(path.join(__dirname,'..','health-center.js'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(ui));
 for(const id of ['scheduleVehicle','scheduleMileage','scheduleName','scheduleDueDate','scheduleDueMiles','scheduleEveryMiles','saveSchedule','scheduleList','exportCalendar','importScheduleFile']){
  assert.ok(html.includes('id="'+id+'"'),id+' is missing');
 }
 for(const source of ['vin','workshop','health','casebook'])assert.match(app,new RegExp("'"+source+"'"));
 assert.match(health,/source:'health'/);
 assert.match(ui,/ravrent_toolkit_v1/);
 assert.match(ui,/ravrent_service_schedule_v1/);
});
