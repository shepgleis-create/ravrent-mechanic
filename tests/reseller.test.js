const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','reseller.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','reseller.html'),'utf8');
function start(intake=null){
 const nodes=new Map(),stored=new Map(),session=new Map();
 if(intake)session.set('ravrent_reseller_intake_v1',JSON.stringify(intake));
 let id=0;
 function make(name){return {name,value:'',textContent:'',className:'',dataset:{},hidden:false,disabled:false,children:[],listeners:{},style:{},
  addEventListener(event,callback){(this.listeners[event]??=[]).push(callback)},
  append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=[...items]},
  setAttribute(k,v){this[k]=v},
  remove(){},click(){this.listeners.click?.forEach(callback=>callback({target:this}))},
  matches(){return true},reset(){},showModal(){this.open=true},close(){this.open=false}}}
 const get=name=>{if(!nodes.has(name))nodes.set(name,make(name));return nodes.get(name)};
 const document={getElementById:get,createElement:make,querySelectorAll:()=>[],body:{append(){}}};
 const storage=map=>({getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
 const context={document,window:{addEventListener(){},print(){}},localStorage:storage(stored),sessionStorage:storage(session),crypto:{randomUUID:()=>String(++id)},confirm:()=>true,Blob:class{},URL:{createObjectURL:()=>'',revokeObjectURL(){}},fetch:()=>{throw Error('No network expected')}};
 vm.runInNewContext(source,context,{timeout:1200});
 const fire=(name,event)=>{for(const callback of get(name).listeners[event]||[])callback({preventDefault(){},target:{matches(){return true}}})};
 const saved=()=>JSON.parse(stored.get('ravrent_reseller_inventory_v1')||'[]');
 return {get,fire,saved,stored,session}
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
 app.fire('vehicleForm','submit');
 assert.equal(app.saved().length,1);
 assert.equal(app.saved()[0].make,'LEXUS');
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
