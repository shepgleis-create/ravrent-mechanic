const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'..','casebook.js'),'utf8');
const core=require('../casebook-core');
function start(intake){
 const nodes=new Map(),stored=new Map(),session=new Map(),downloads=[];let printed=false;
 function node(tag){
  const item={tagName:tag,value:'',textContent:'',className:'',classList:{toggle(){},add(){},remove(){}},dataset:{},style:{},children:[],listeners:{},checked:false,hidden:false,disabled:false,files:[],type:'',isConnected:true,
   append(...children){for(const child of children){child.parent=this;this.children.push(child)}},
   replaceChildren(...children){this.children=[];this.append(...children)},
   remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)},
   addEventListener(event,fn){(this.listeners[event]??=[]).push(fn)},
   setAttribute(n,v){this[n]=v},
   showModal(){this.open=true},close(){this.open=false},reset(){},
   querySelector(selector){
    const kind=selector.match(/^\[data-kind="([^"]+)"\]$/)?.[1];
    if(kind){for(const c of this.children)if(c.dataset?.kind===kind)return c}
    return null
   }
  };
  return item;
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)};
 const hazard=name=>{const id='hazard-'+name;return get(id)};
 const buttons=['all','open','testing','awaiting','resolved'].map(stage=>{const el=node('button');el.dataset.stage=stage;return el});
 const doc={getElementById:get,querySelector:s=>{
  const h=s.match(/^\[data-hazard="([^"]+)"\]$/)?.[1];return h?hazard(h):null
 },querySelectorAll:s=>s==='[data-stage]'?buttons:[],createElement:node,body:{append(){}}};
 const LS=map=>({getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
 if(intake)session.set('ravrent_casebook_intake_v1',JSON.stringify(intake));
 const ctx={document:doc,window:{RavrentCasebookCore:core,addEventListener(){},print(){printed=true}},
  localStorage:LS(stored),sessionStorage:LS(session),location:{href:''},URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},
  Blob:class{constructor(parts){this.parts=parts;downloads.push(this)}},setTimeout:()=>1,confirm:()=>true};
 vm.runInNewContext(script,ctx);
 const fire=async(id,event='click')=>Promise.all((get(id).listeners[event]||[]).map(fn=>fn({preventDefault(){},target:{value:get(id).value,files:get(id).files}})));
 return{get,hazard,fire,stored,session,downloads,location:ctx.location,printed:()=>printed,records:()=>JSON.parse(stored.get('ravrent_diagnostic_casebook_v1')||'[]')};
}
test('diagnostic worksheet saves documented tests, codes and safety conditions locally',async()=>{
 const app=start();await app.fire('newCase');
 assert.equal(app.get('caseDialog').open,true);
 app.get('caseName').value='Intermittent power steering';
 app.get('caseVehicle').value='2009 Lexus IS250';
 app.get('caseMiles').value='158200';
 app.get('caseCodes').value='P0300, p0300, U0100';
 app.get('caseSymptoms').value='Steering assistance intermittently drops';
 app.hazard('steering').checked=true;await app.fire('caseHazards','change');
 const testRow=app.get('caseTests').children[0];
 testRow.querySelector('[data-kind="name"]').value='Measure alternator output';
 testRow.querySelector('[data-kind="result"]').value='planned';
 app.get('costDiagnostic').value='50';app.get('costParts').value='125.50';
 await app.fire('caseForm','submit');
 assert.equal(app.records().length,1);
 const c=app.records()[0];
 assert.deepEqual(c.codes,['P0300','U0100']);
 assert.equal(c.flags.steering,true);
 assert.equal(c.tests[0].result,'planned');
 assert.equal(c.amounts.total,175.5);
 assert.equal(app.get('urgentCases').textContent,'1');
});
test('incomplete case cannot be saved as a valid diagnosis',async()=>{
 const app=start();await app.fire('newCase');await app.fire('caseForm','submit');
 assert.equal(app.records().length,0);
 assert.match(app.get('caseFeedback').textContent,/title/i);
});
test('VIN research can prefill a new diagnostic case, without inventing findings',()=>{
 const app=start({vin:'1HGCM82633A004352',vehicle:'2003 Honda Accord EX'});
 assert.equal(app.get('caseDialog').open,true);
 assert.equal(app.get('caseVehicle').value,'2003 Honda Accord EX');
 assert.equal(app.get('caseVin').value,'1HGCM82633A004352');
 assert.equal(app.records().length,0);
 assert.equal(app.session.has('ravrent_casebook_intake_v1'),false);
});
test('case to AI and workshop handoffs require a tap and do not contact providers automatically',async()=>{
 const app=start();await app.fire('newCase');
 app.get('caseName').value='Voltage issue';
 app.get('caseVehicle').value='2009 Lexus IS 250';
 app.get('caseSymptoms').value='Battery light on';
 await app.fire('caseAI');
 assert.equal(app.location.href,'/');
 const review=JSON.parse(app.session.get('ravrent_ai_intake_v1'));
 assert.equal(review.source,'casebook');
 assert.match(review.question,/Battery light on/);
 assert.doesNotMatch(review.question,/customer@email/i);
 const more=start();await more.fire('newCase');
 more.get('caseName').value='Check voltage';more.get('caseVehicle').value='2009 Lexus IS 250';
 await more.fire('caseToWorkshop');
 assert.equal(more.location.href,'/workshop.html');
 assert.equal(JSON.parse(more.session.get('ravrent_workshop_intake_v1')).vehicle,'2009 Lexus IS 250');
});
test('printable report reflects saved evidence, not verified repairs',async()=>{
 const app=start();await app.fire('newCase');app.get('caseName').value='Cold-start noise';app.get('caseVehicle').value='2005 Infiniti G35';
 await app.fire('caseForm','submit');
 const card=app.get('caseList').children[0];const print=card.children[1].children.find(x=>x.textContent==='Print / PDF');assert.ok(print);
 print.onclick();assert.equal(app.printed(),true);
 const report=app.get('casePrint');
 assert.ok(report.children.some(x=>x.textContent==='Vehicle diagnostic case'));
 assert.ok(report.children.some(x=>x.textContent.includes('not independently verified')));
});
test('JSON backup and restore never duplicate an existing case',async()=>{
 const src=start();await src.fire('newCase');src.get('caseName').value='Issue';src.get('caseVehicle').value='Car';await src.fire('caseForm','submit');
 await src.fire('casesBackup');assert.equal(src.downloads.length,1);
 const body=src.downloads[0].parts[0],dest=start();dest.get('casesImport').files=[{size:body.length,text:async()=>body}];
 await dest.fire('casesImport','change');assert.equal(dest.records().length,1);
 dest.get('casesImport').files=[{size:body.length,text:async()=>body}];
 await dest.fire('casesImport','change');assert.equal(dest.records().length,1);
});
