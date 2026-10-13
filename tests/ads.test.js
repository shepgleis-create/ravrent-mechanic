const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const api=fs.readFileSync(path.join(__dirname,'..','api','ads-config.js'),'utf8');
const client=fs.readFileSync(path.join(__dirname,'..','ads.js'),'utf8');
const guides=fs.readFileSync(path.join(__dirname,'..','guides.html'),'utf8');
const adsTxt=fs.readFileSync(path.join(__dirname,'..','ads.txt'),'utf8');
function call(env){
 const module={exports:{}};
 vm.runInNewContext(api,{module,process:{env}});
 const res={code:200,value:null,setHeader(){},status(n){this.code=n;return this},json(data){this.value=data;return this}};
 module.exports({method:'GET'},res);return res.value
}
const flags={ADSENSE_ENABLED:'true',ADSENSE_APPROVED:'true',ADSENSE_CONSENT_READY:'true',ADSENSE_PUBLISHER_ID:'ca-pub-4885780170355707',ADSENSE_GUIDE_SLOT:'1234567890'};
test('AdSense declaration is valid and matches existing site owner verification tag',()=>{
 assert.equal(adsTxt.trim(),'google.com, pub-4885780170355707, DIRECT, f08c47fec0942fa0');
 assert.match(guides,/name="google-adsense-account" content="ca-pub-4885780170355707"/)
});
test('AdSense is off by default and until every approval, consent and slot requirement passes',()=>{
 assert.equal(call({}).enabled,false);
 for(const key of Object.keys(flags)){const env={...flags};delete env[key];assert.equal(call(env).enabled,false,'missing '+key+' must stop ads')}
 assert.equal(call({...flags,ADSENSE_GUIDE_SLOT:'not-a-real-slot'}).enabled,false);
 assert.equal(call(flags).enabled,true);
 assert.equal(call(flags).placements.guides,'1234567890');
 assert.equal(call(flags).publisherId,'ca-pub-4885780170355707');
});
test('ads only target original guide pages, never private diagnostic or VIN routes',()=>{
 assert.doesNotThrow(()=>new vm.Script(client));
 assert.match(client,/data-ravrent-ad/);
 assert.match(client,/ravrent_ads_disabled/);
 assert.match(client,/globalPrivacyControl/);
 assert.ok((guides.match(/data-ravrent-ad="guides"/g)||[]).length>=1);
 assert.doesNotMatch(client,/\/(api\/chat|api\/vin)/);
});
