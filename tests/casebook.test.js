const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../casebook-core');
const html=fs.readFileSync(path.join(__dirname,'..','casebook.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','casebook.js'),'utf8');
test('casebook normalizes and deduplicates real OBD trouble code patterns',()=>{
 assert.deepEqual(core.parseCodes('p0300; P0300, u0100 b0020 c1234 invalid P0000Z'),['P0300','U0100','B0020','C1234']);
 assert.equal(core.parseCodes('no codes').length,0);
});
test('safety flags describe reported risk but do not certify roadworthiness',()=>{
 const concern=core.triage({brakes:true,overheat:true});
 assert.equal(concern.high,true);assert.match(concern.reason,/stop/i);
 const none=core.triage({});
 assert.equal(none.high,false);assert.match(none.reason,/does not prove.*safe/i);
});
test('case normalizer preserves evidence but does not invent completed tests',()=>{
 const c=core.normalizeCase({name:'Cold-start tick',vehicle:'2005 Infiniti G35',miles:'186000',codes:'P0300',flags:{smoke:false},
  tests:[{name:'Check battery voltage',result:'planned'},{name:'Compression test',result:'fail',note:'Owner noted low cylinder result'}]});
 assert.equal(c.name,'Cold-start tick');assert.equal(c.miles,'186000');
 assert.equal(c.codes[0],'P0300');assert.equal(c.tests[0].result,'planned');
 assert.equal(c.tests[1].result,'fail');assert.equal(c.tests.length,2);
});
test('invalid VIN, negative expenses and missing case identification are rejected',()=>{
 assert.throws(()=>core.normalizeCase({vehicle:'Car'}),/title/);
 assert.throws(()=>core.normalizeCase({name:'Issue',vehicle:'Car',vin:'BADVIN'}),/VIN/);
 assert.throws(()=>core.normalizeCase({name:'Issue',vehicle:'Car',amounts:{parts:-50}}),/nonnegative/);
 assert.equal(core.totals({diagnostic:'55',parts:'120.75',labor:'200',other:'10'}).total,385.75);
});
test('AI review shares only user-recorded vehicle facts and uncertainty, not a fabricated fix',()=>{
 const c=core.normalizeCase({name:'Low voltage',vehicle:'2009 Lexus IS 250',codes:'P0300',flags:{brakes:true},
  tests:[{name:'Charging voltage measured',result:'planned',note:'Awaiting voltmeter'}]});
 const context=core.exportReview(c);
 assert.match(context,/2009 Lexus/);assert.match(context,/P0300/);assert.match(context,/urgent|safety/i);
 assert.match(context,/Planned|planned/);
 assert.doesNotMatch(context,/verified repair|repair completed/i);
});
test('casebook UI has complete usable controls and valid JavaScript',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(v=>v[1]);
 for(const id of ['caseDialog','caseForm','caseName','caseVehicle','caseVin','caseCodes','caseHazards','caseTests','caseAI','caseToWorkshop','caseList','casesBackup','casesImport','casePrint'])
  assert.ok(ids.includes(id),'Missing '+id);
 assert.equal(ids.length,new Set(ids).size,'Duplicate IDs');
 assert.ok(html.includes('src="/casebook-core.js"'));
 assert.doesNotMatch(html,/<a[^>]+href="https?:/i);
});

test('six diagnostic templates insert only planned checks and do not claim a fix',()=>{
 const ids=Object.keys(core.TEST_TEMPLATES);
 assert.equal(ids.length,6);
 for(const id of ids){const checks=core.templateTests(id);assert.ok(checks.length>=3);
  assert.ok(checks.every(item=>item.result==='planned'&&item.note===''))}
 assert.deepEqual(core.templateTests('unknown'),[]);
});
