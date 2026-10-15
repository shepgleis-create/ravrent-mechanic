const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const planner=fs.readFileSync(path.join(__dirname,'..','maintenance-planner.js'),'utf8');
const core=require('../maintenance-core');
function sandbox(){
 const elements=new Map(),saved=new Map([['ravrent-mechanic-v2',JSON.stringify({vehicles:[{id:'v1',year:2009,make:'Lexus',model:'IS 250',miles:116500}]})]]),notifications=[];
 function node(tag='div'){
  return {tagName:tag,value:'',type:'',textContent:'',id:'',hidden:false,disabled:false,children:[],className:'',style:{},dataset:{},handlers:{},
   append(...kids){this.children.push(...kids);for(const c of kids)c.parentNode=this},
   replaceChildren(...kids){this.children=[];this.append(...kids)},
   addEventListener(event,cb){this.handlers[event]=cb},
   click(){this.handlers.click?.()},
   focus(){},
   remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(e=>e!==this)},
   setAttribute(name,value){this[name]=value},
   querySelector(selector){return this.children.find(x=>x.className===selector.slice(1))||null}
  };
 }
 const $=id=>{if(!elements.has(id))elements.set(id,node(id));return elements.get(id)};
 const document={getElementById:$,createElement:node,body:{append(){}}};
 const localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)};
 const sessionStorage={setItem:(k,v)=>saved.set('session:'+k,String(v))};
 const window={RavrentSchedule:core,dispatchEvent:event=>notifications.push(event.type)};
 const context={document,localStorage,sessionStorage,window,location:{href:''},confirm:()=>true,
  crypto:{randomUUID:()=> 'test-task-id'},Option:class{constructor(text,value){this.textContent=text;this.value=value}},
  Event:class{constructor(type){this.type=type}},Intl,Date,Math,Number,String,Object,Array,JSON,
  Blob:class{constructor(parts){this.parts=parts}},URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},setTimeout:()=>1
 };
 vm.runInNewContext(planner,context);
 return {$,saved,notifications,click:id=>$(id).handlers.click?.(),change:(id)=>$(id).handlers.change?.({target:$(id)})};
}
test('Garage-linked schedule UI creates a real mileage reminder and marks it due',()=>{
 const app=sandbox();
 app.$('scheduleName').value='Brake fluid inspection';
 app.$('scheduleDueMiles').value='117000';
 app.$('scheduleEveryMiles').value='5000';
 app.click('saveSchedule');
 const saved=JSON.parse(app.saved.get('ravrent_service_schedule_v1'));
 assert.equal(saved.plans.length,1);
 assert.equal(saved.plans[0].dueMileage,117000);
 assert.equal(saved.plans[0].intervalMiles,5000);
 app.$('scheduleMileage').value='117200';
 app.click('saveMileage');
 assert.equal(app.$('scheduleDue').textContent,'1');
});
test('Saving a completed service updates both scheduler and existing Ownership Toolkit log',()=>{
 const app=sandbox();
 app.$('scheduleName').value='Replace cabin filter';
 app.$('scheduleDueMiles').value='117000';
 app.$('scheduleEveryMiles').value='12000';
 app.click('saveSchedule');
 const row=app.$('scheduleList').children[0];
 const actions=row.children.find(x=>x.className==='case-actions'),completion=row.children.find(x=>x.className==='schedule-completion');
 assert.ok(actions&&completion);
 actions.children[2].onclick();
 assert.equal(completion.hidden,false);
 completion.children[1].children[0].value='117200';
 completion.children[2].children[0].value='45.50';
 completion.children[3].onclick();
 const saved=JSON.parse(app.saved.get('ravrent_service_schedule_v1'));
 assert.equal(saved.plans[0].dueMileage,129200);
 assert.equal(saved.plans[0].history[0].miles,117200);
 const toolkit=JSON.parse(app.saved.get('ravrent_toolkit_v1'));
 assert.equal(toolkit.services[0].service,'Replace cabin filter');
 assert.equal(toolkit.services[0].cost,45.5);
 assert.ok(app.notifications.includes('ravrent:maintenance-updated'));
});
