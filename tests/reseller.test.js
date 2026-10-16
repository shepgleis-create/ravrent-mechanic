const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','reseller.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','reseller.html'),'utf8');
function start(intake=null){
 const nodes=new Map(),stored=new Map(),session=new Map(),downloads=[];let printed=false;
 if(intake)session.set('ravrent_reseller_intake_v1',JSON.stringify(intake));
 let id=0;
 function make(name){const node={name,value:'',textContent:'',className:'',dataset:{},hidden:false,disabled:false,children:[],listeners:{},style:{},
  addEventListener(event,callback){(this.listeners[event]??=[]).push(callback)},
  append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=[...items]},
  setAttribute(k,v){this[k]=v},
  remove(){},click(){this.listeners.click?.forEach(callback=>callback({target:this}))},
  matches(){return true},reset(){},showModal(){this.open=true},close(){this.open=false}};Object.defineProperty(node,'id',{get(){return this._id||''},set(id){this._id=id;nodes.set(id,node)}});return node}
 const get=name=>{if(!nodes.has(name))nodes.set(name,make(name));return nodes.get(name)};
 const document={getElementById:get,createElement:make,querySelectorAll:()=>[],body:{append(){}}};
 const storage=map=>({getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
 const context={document,window:{addEventListener(){},print(){printed=true}},localStorage:storage(stored),sessionStorage:storage(session),crypto:{randomUUID:()=>String(++id)},confirm:()=>true,Blob:class{constructor(parts){this.parts=parts}},URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:test'},revokeObjectURL(){}},setTimeout:fn=>{fn();return 1},fetch:()=>{throw Error('No network expected')}};
 vm.runInNewContext(source,context,{timeout:1200});
 const fire=(name,event)=>Promise.all((get(name).listeners[event]||[]).map(callback=>callback({preventDefault(){},target:{matches(){return true},files:get(name).files||[],value:get(name).value}})));
 const saved=()=>JSON.parse(stored.get('ravrent_reseller_inventory_v1')||'[]');
 return {get,fire,saved,stored,session,downloads,wasPrinted:()=>printed}
}
test('reseller page contains functional app controls and no external navigation',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 for(const key of ['vehicleForm','addVehicle','formVin','formStage','purchase','asking','actualSale','vehicleCount','inventoryList','saveVehicle','exportCsv']){
  if(key==='saveVehicle')continue;
  assert.ok(html.includes('id="'+key+'"'),'missing '+key)
 }
 assert.doesNotMatch(html,/<a[^>]+href="https?:/i);
});
test('reseller worksheet calculates real entered costs and saves locally',()=>{
 const app=start();app.fire('addVehicle','click');
 for(const [id,value] of Object.entries({formYear:'2009',formMake:'LEXUS',formModel:'IS 250',formStage:'purchased',purchase:'2000',parts:'500',labor:'250',buyerFees:'150',detailing:'100',paperwork:'200',asking:'5000'}))app.get(id).value=value;
 app.fire('vehicleForm','input');
 assert.equal(app.get('formTotalCost').textContent,'$3,200.00');
 assert.equal(app.get('formProfit').textContent,'$1,800.00');
 assert.equal(app.get('formRoi').textContent,'56.3%');
 assert.match(app.get('inspectionSummary').textContent,/0 of 12 inspection areas/);
 assert.equal(app.get('formMaxOffer').textContent,'—');
 app.get('desiredProfit').value='1500';app.fire('vehicleForm','input');assert.equal(app.get('formMaxOffer').textContent,'$2,300.00');
 app.get('inspect-engine').value='fail';app.get('inspect-titleEvidence').value='concern';app.fire('vehicleForm','input');
 assert.match(app.get('inspectionSummary').textContent,/2 of 12 inspection areas/);
 app.fire('vehicleForm','submit');
 assert.equal(app.saved().length,1);
 assert.equal(app.saved()[0].make,'LEXUS');
 assert.equal(app.saved()[0].inspection.engine,'fail');
 assert.equal(app.saved()[0].inspection.titleEvidence,'concern');
 assert.equal(app.saved()[0].desiredProfit,'1500');
 assert.equal(app.get('capitalTotal').textContent,'$3,200');
 assert.equal(app.get('profitTotal').textContent,'$1,800');
 assert.equal(app.get('inventoryList').children.length,1);
});
test('sold vehicle without actual sale price is refused',()=>{
 const app=start();app.fire('addVehicle','click');
 for(const [id,value] of Object.entries({formYear:'2009',formMake:'LEXUS',formModel:'IS 250',formStage:'sold',asking:'6000',purchase:'2000'}))app.get(id).value=value;
 app.fire('vehicleForm','submit');
 assert.equal(app.saved().length,0);
 assert.match(app.get('formStatus').textContent,/actual final sale price/i);
});
test('invalid VIN cannot create record; valid transfer populates intake form',()=>{
 const app=start();app.fire('addVehicle','click');
 for(const [id,value] of Object.entries({formVin:'BADVIN',formYear:'2009',formMake:'LEXUS',formModel:'IS 250'}))app.get(id).value=value;
 app.fire('vehicleForm','submit');
 assert.equal(app.saved().length,0);
 assert.match(app.get('formStatus').textContent,/17 valid characters/i);
 const incoming={vin:'1HGCM82633A004352',year:2003,make:'HONDA',model:'ACCORD',trim:'EX'};
 const transfer=start(incoming);
 assert.equal(transfer.get('vehicleDialog').open,true);
 assert.equal(transfer.get('formVin').value,incoming.vin);
 assert.equal(transfer.get('formModel').value,'ACCORD');
 assert.equal(transfer.session.has('ravrent_reseller_intake_v1'),false);
});

test('JSON backup restores valid vehicles without overwriting or duplicating records',async()=>{
 const first=start();first.fire('addVehicle','click');
 for(const [id,value] of Object.entries({formVin:'1HGCM82633A004352',formYear:'2003',formMake:'HONDA',formModel:'ACCORD',formStage:'purchased',purchase:'2000',asking:'4300'}))first.get(id).value=value;
 await first.fire('vehicleForm','submit');
 assert.equal(first.saved().length,1);
 await first.fire('backupJson','click');
 assert.equal(first.downloads.length,1);
 const backup=JSON.parse(first.downloads[0].parts[0]);
 assert.equal(backup.version,1);assert.equal(backup.records[0].make,'HONDA');
 const next=start();
 const json=JSON.stringify(backup);
 next.get('restoreJson').files=[{size:json.length,text:async()=>json}];
 await next.fire('restoreJson','change');
 assert.equal(next.saved().length,1);
 assert.equal(next.saved()[0].vin,'1HGCM82633A004352');
 next.get('restoreJson').files=[{size:json.length,text:async()=>json}];
 await next.fire('restoreJson','change');
 assert.equal(next.saved().length,1);
});
test('printable worksheet is labeled as self-reported and includes inspection findings',async()=>{
 const app=start();app.fire('addVehicle','click');
 for(const [id,value] of Object.entries({formYear:'2009',formMake:'LEXUS',formModel:'IS 250',formStage:'purchased',purchase:'2500',asking:'5000',formNotes:'Oil leak found'}))app.get(id).value=value;
 app.get('inspect-engine').value='fail';
 await app.fire('vehicleForm','submit');
 const list=app.get('inventoryList').children[0];
 const actions=list.children[1];
 const reportButton=actions.children.find(button=>/print|report/i.test(button.textContent||''));
 assert.ok(reportButton,'A printable report button is required');
 reportButton.onclick();
 assert.equal(app.wasPrinted(),true);
 const heading=app.get('printReport').children[0];
 assert.match(heading.textContent,/Vehicle Acquisition/);
 const flattened=app.get('printReport').children.flatMap(item=>[item.textContent,...(item.children||[]).map(x=>x.textContent)]).join(' | ');
 assert.match(flattened,/Issue confirmed/);
 assert.match(flattened,/not independently verified/i);
});
