const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','vin-report.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','vin-report.js'),'utf8');
const scanner=fs.readFileSync(path.join(__dirname,'..','vin-scanner.js'),'utf8');
test('VIN intelligence markup maintains valid nesting and no external user redirects',()=>{
 const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 const stack=[];
 for(const match of html.matchAll(/<(\/)?([a-z][\w-]*)\b[^>]*>/gi)){
  const closing=Boolean(match[1]),tag=match[2].toLowerCase();
  if(voids.has(tag))continue;
  if(!closing){stack.push(tag);continue}
  const expected=stack.pop();
  assert.equal(expected,tag,'incorrect markup nesting near '+tag);
 }
 assert.deepEqual(stack,[]);
 assert.doesNotMatch(html,/<a[^>]+href="https?:/i);
});
test('all required VIN scanning, recall, and reseller controls exist',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
 const refs=[...js.matchAll(/\$\('([^']+)'\)/g),...scanner.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
 for(const id of refs)assert.ok(ids.has(id),'missing element #'+id);
 for(const id of ['saveToReseller','scanVin','vinPhoto','captureVin','recallResults','complaintResults','safetyResults','checks','vinRecallStatus']){
  assert.ok(ids.has(id),'missing key workflow control #'+id)
 }
 assert.equal(ids.size,[...html.matchAll(/\bid="([^"]+)"/g)].length,'duplicate IDs');
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.doesNotThrow(()=>new vm.Script(scanner));
});
test('VIN lookup supports inventory deep links and per-VIN inspection persistence',()=>{
 assert.match(js,/new URLSearchParams\(location\.search\)\.get\('vin'\)/);
 assert.match(js,/const reviewKey=vin/);
 assert.match(js,/localStorage\.setItem\(reviewKey\(current\.vin\)/);
 assert.match(js,/loadReview\(vin\)/);
 assert.match(js,/saveToReseller/);
});
