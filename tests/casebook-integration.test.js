const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('Casebook is reachable from app, workshop, VIN research, toolkit and public sitemap',()=>{
 for(const page of ['index.html','toolkit.html','workshop.html','reseller.html','health-center.html']){
  assert.match(read(page),/href="\/casebook\.html"/,'Missing Casebook navigation: '+page)
 }
 assert.match(read('sitemap.xml'),/ravrent-mechanic\.vercel\.app\/casebook\.html/);
 assert.match(read('pricing.html'),/Diagnostic Casebook/);
});
test('VIN, casebook, workshop and AI handoffs are internal and require explicit taps',()=>{
 const vin=read('vin-report.js'),page=read('vin-report.html'),casebook=read('casebook.js'),shop=read('workshop.js'),chat=read('app.js');
 assert.match(page,/id="openCasebook"/);
 assert.match(vin,/\$\('openCasebook'\)\.onclick/);
 assert.match(vin,/ravrent_casebook_intake_v1/);
 assert.match(casebook,/ravrent_casebook_intake_v1/);
 assert.match(casebook,/ravrent_ai_intake_v1/);
 assert.match(casebook,/ravrent_workshop_intake_v1/);
 assert.match(shop,/typeof data\?\.note==='string'/);
 for(const source of ['vin','workshop','health','casebook','fleet'])assert.match(chat,new RegExp("'"+source+"'"));
 for(const src of [vin,casebook,shop,chat])assert.doesNotThrow(()=>new vm.Script(src));
});
test('Casebook has no automatic AI requests, implied completed tests or paid checkout',()=>{
 const html=read('casebook.html'),js=read('casebook.js');
 assert.doesNotMatch(js,/fetch\(['"]\/api\/chat/);
 assert.doesNotMatch(html,/checkout\.stripe\.com|payment received|signed invoice/i);
 assert.match(js,/planned/i);
 assert.match(html,/not independently verified/i);
 assert.match(html,/No AI credits required|no AI credits required/i);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 const used=[...js.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,'Duplicate Casebook IDs');
 for(const id of used)assert.ok(ids.includes(id),'Casebook references missing #'+id);
});
