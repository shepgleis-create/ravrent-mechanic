const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('new topic guides are useful, internally linked and reserved ads stay disabled by default',()=>{
 for(const file of ['guides/p0300.html','guides/p0420.html']){
  const html=read(file);
  assert.match(html,/<meta name="description" content="[^"]{50,}/);
  assert.match(html,/<link rel="canonical"/);
  assert.match(html,/href="\/toolkit\.html"/);
  assert.match(html,/href="\/workshop\.html"/);
  assert.match(html,/data-ravrent-ad="guides" hidden/);
  assert.match(html,/<script defer src="\/ads\.js"/);
  const sections=[...html.matchAll(/<section id="section-(\d+)" class="article-section"/g)].map(x=>Number(x[1]));
  assert.ok(sections.length>=6,file+' needs substantial original content');
  assert.equal(new Set(sections).size,sections.length);
  for(const number of sections)assert.match(html,new RegExp('href="#section-'+number+'"'));
  assert.doesNotMatch(html,/<a[^>]+href="https?:/i);
 }
});
test('sitemap and the original learning-center navigation expose both articles',()=>{
 const map=read('sitemap.xml'),guides=read('guides.html');
 for(const pathName of ['guides/p0300.html','guides/p0420.html']){
  assert.ok(map.includes('https://ravrent-mechanic.vercel.app/'+pathName));
  assert.ok(guides.includes('href="/'+pathName+'"'))
 }
});
test('workshop gets vehicle context from both reseller and VIN scanner without new external route',()=>{
 const vin=read('vin-report.js'),reseller=read('reseller.js'),shop=read('workshop.js');
 const handoff='ravrent_workshop_intake_v1';
 assert.ok(vin.includes(handoff));assert.ok(reseller.includes(handoff));assert.ok(shop.includes(handoff));
 assert.match(shop,/sessionStorage\.removeItem\('ravrent_workshop_intake_v1'\)/);
 assert.doesNotThrow(()=>new vm.Script(shop));
 assert.doesNotThrow(()=>new vm.Script(vin));
 assert.doesNotThrow(()=>new vm.Script(reseller));
});
