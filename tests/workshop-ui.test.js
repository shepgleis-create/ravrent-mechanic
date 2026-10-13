const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'..','workshop.js'),'utf8');
const mathScript=fs.readFileSync(path.join(__dirname,'..','workshop-core.js'),'utf8');
function simulate(){
 const nodes=new Map(),storage=new Map(),session=new Map(),downloaded=[];let clickedPrint=false;
 function node(tag){
  const obj={tagName:tag,className:'',dataset:{},style:{},value:'',textContent:'',type:'',checked:false,hidden:false,disabled:false,children:[],listeners:{},isConnected:true,
   addEventListener(n,f){(this.listeners[n]??=[]).push(f)},
   setAttribute(k,v){this[k]=v},
   append(...kids){for(const kid of kids){kid.parentNode=this;this.children.push(kid)}},
   replaceChildren(...kids){this.children=[];this.append(...kids)},
   remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this)},
   click(){return Promise.all((this.listeners.click||[]).map(f=>f({preventDefault(){},target:this})))},
   showModal(){this.open=true},close(){this.open=false},reset(){},
   querySelectorAll(selector){const match=el=>selector==='.estimate-line'?el.className?.split(' ').includes('estimate-line'):
    selector==='[data-field]'?Boolean(el.dataset?.field):
    selector.startsWith('[data-field="')?el.dataset?.field===selector.slice(13,-2):
    selector.startsWith('.')?el.className?.split(' ').includes(selector.slice(1)):false;
    const all=[];const visit=parent=>{for(const child of parent.children){if(match(child))all.push(child);visit(child)}};visit(this);return all},
   querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  };return obj
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)};
 const stageButtons=['all','draft','quoted','approved','progress','completed'].map(stage=>{const button=node('button');button.dataset.stage=stage;return button});
 const doc={getElementById:get,createElement:node,querySelectorAll:selector=>selector==='[data-stage]'?stageButtons:[],body:{append(){}}};
 const local={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const sessions={getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)};
 const window={crypto:{randomUUID:()=>String(storage.size+1)+'-quote'},addEventListener(){},print(){clickedPrint=true}};
 const coreContext={window,module:{exports:{}}};vm.runInNewContext(mathScript,coreContext);
 window.RavrentWorkshopCore=coreContext.module.exports;
 const context={document:doc,window,localStorage:local,sessionStorage:sessions,confirm:()=>true,
  Blob:class{constructor(parts){this.parts=parts;downloaded.push(this)}},
  URL:{createObjectURL:()=>'blob:fixture',revokeObjectURL(){}},setTimeout:()=>0};
 vm.runInNewContext(script,context);
 const fire=async(id,event='click')=>{const el=get(id);await Promise.all((el.listeners[event]||[]).map(f=>f({preventDefault(){},target:{value:el.value,files:el.files||[],matches(){return true}}})))};
 const saved=()=>JSON.parse(storage.get('ravrent_workshop_estimates_v1')||'[]');
 return {get,fire,saved,storage,session,downloaded,printed:()=>clickedPrint}
}
test('workshop browser workflow saves customer quote, updates counters and prepares printable estimate',async()=>{
 const a=simulate();await a.fire('createQuote');
 assert.equal(a.get('quoteDialog').open,true);
 a.get('shopName').value='Test Garage';
 a.get('customerName').value='Test Customer';
 a.get('customerVehicle').value='2009 Lexus IS 250';
 a.get('quoteTax').value='8.25';a.get('quoteDiscount').value='15';a.get('quoteDeposit').value='20';
 const first=a.get('quoteLines').children[0];
 first.querySelector('[data-field="description"]').value='Diagnostic labor';
 first.querySelector('[data-field="quantity"]').value='2';
 first.querySelector('[data-field="unitPrice"]').value='95';
 first.querySelector('[data-field="internalCost"]').value='45';
 await a.fire('addLine');
 const second=a.get('quoteLines').children[1];
 second.querySelector('[data-field="description"]').value='Replacement part';
 second.querySelector('[data-field="kind"]').value='part';
 second.querySelector('[data-field="quantity"]').value='1';
 second.querySelector('[data-field="unitPrice"]').value='125';
 second.querySelector('[data-field="internalCost"]').value='80';
 second.querySelector('[data-field="taxable"]').checked=true;
 await a.fire('quoteForm','input');
 assert.equal(a.get('customerTotal').textContent,'$309.82');
 assert.equal(a.get('marginTotal').textContent,'$130.00');
 await a.fire('quoteForm','submit');
 assert.equal(a.saved().length,1);
 assert.equal(a.get('quoteCount').textContent,'1');
 assert.equal(a.saved()[0].items.length,2);
 assert.equal(a.saved()[0].customerName,'Test Customer');
 const card=a.get('quoteList').children[0],print=card.children[1].children[1];
 print.onclick();
 assert.equal(a.printed(),true);
 const out=a.get('workshopPrint');
 assert.ok(out.children.some(c=>c.textContent==='REPAIR ESTIMATE'));
 assert.equal(out.children.some(c=>c.textContent.includes('Internal unit cost')),false);
});
test('invalid or incomplete customer estimate cannot be saved',async()=>{
 const a=simulate();await a.fire('createQuote');await a.fire('quoteForm','submit');
 assert.equal(a.saved().length,0);
 assert.match(a.get('quoteFeedback').textContent,/Shop name/);
});
