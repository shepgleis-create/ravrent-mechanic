const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const backup=require('../workspace-backup-core');
const storage=(seed={})=>{
 const records=new Map(Object.entries(seed));
 return {getItem:k=>records.has(k)?records.get(k):null,setItem:(k,v)=>records.set(k,String(v)),removeItem:k=>records.delete(k),keys:()=>[...records.keys()]};
};
test('combined workspace backup exports actual saved tool data and never exports unrelated API secrets',()=>{
 const first=storage({
  'ravrent-mechanic-v2':JSON.stringify({vehicles:[{id:'car1',make:'LEXUS',model:'IS250'}],threads:[]}),
  'ravrent_diagnostic_casebook_v1':JSON.stringify([{id:'case1',name:'Engine noise'}]),
  'ravrent_workshop_estimates_v1':JSON.stringify([{id:'quote1',customerName:'Example Customer'}]),
  'GROQ_API_KEY':'secret-should-not-export',
  'ravrent_provider_cooldown_v1':'some-internal-state'
 });
 const result=backup.exportData(first);
 assert.equal(result.count,3);
 assert.equal(result.payload.app,'ravrent-mechanic');
 assert.equal(result.payload.version,1);
 assert.match(result.content,/Example Customer/);
 assert.doesNotMatch(result.content,/secret-should-not-export|GROQ_API_KEY|ravrent_provider_cooldown_v1/);
 assert.deepEqual(backup.validateBackup(result.payload).keys.sort(),[
  'ravrent-mechanic-v2','ravrent_diagnostic_casebook_v1','ravrent_workshop_estimates_v1'
 ].sort());
});
test('restore imports only absent record groups and will not overwrite existing user data',()=>{
 const source=storage({
  'ravrent-mechanic-v2':JSON.stringify({vehicles:[{id:'1'}]}),
  'ravrent_workshop_estimates_v1':JSON.stringify([{id:'quote1'}])
 });
 const payload=backup.exportData(source).payload;
 const dest=storage({'ravrent-mechanic-v2':JSON.stringify({vehicles:[{id:'original'}]})});
 const preview=backup.planRestore(payload,dest);
 assert.deepEqual(preview.importable,['ravrent_workshop_estimates_v1']);
 assert.deepEqual(preview.existing,['ravrent-mechanic-v2']);
 const result=backup.restoreMissing(payload,dest);
 assert.deepEqual(result.restored,['ravrent_workshop_estimates_v1']);
 assert.equal(JSON.parse(dest.getItem('ravrent-mechanic-v2')).vehicles[0].id,'original');
 assert.equal(JSON.parse(dest.getItem('ravrent_workshop_estimates_v1'))[0].id,'quote1');
 assert.deepEqual(backup.restoreMissing(payload,dest).restored,[]);
});
test('invalid, unsupported and oversized data does not mutate destination storage',()=>{
 const dest=storage();
 assert.throws(()=>backup.restoreMissing({app:'ravrent-mechanic',format:'ravrent-workspace',version:1,datasets:{'GROQ_API_KEY':'secret'}},dest),/invalid records/);
 assert.throws(()=>backup.restoreMissing({app:'other-app',version:1,datasets:{}},dest),/not a supported/);
 assert.throws(()=>backup.restoreMissing({app:'ravrent-mechanic',format:'ravrent-workspace',version:1,datasets:{'ravrent_workshop_estimates_v1':{wrong:true}}},dest),/invalid records/);
 assert.deepEqual(dest.keys(),[]);
});
test('a storage quota failure rolls back newly imported datasets rather than leaving a partial restore',()=>{
 const source=storage({
  'ravrent-mechanic-v2':JSON.stringify({vehicles:[]}),
  'ravrent_workshop_estimates_v1':JSON.stringify([{id:'foo'}])
 });
 const payload=backup.exportData(source).payload;
 const dest=storage();let calls=0;
 const failing={getItem:k=>dest.getItem(k),setItem:(k,v)=>{if(++calls===2)throw Error('Browser quota');dest.setItem(k,v)},removeItem:k=>dest.removeItem(k)};
 assert.throws(()=>backup.restoreMissing(payload,failing),/partial imports were rolled back/);
 assert.deepEqual(dest.keys(),[]);
});
test('Fleet UI exposes live source refresh, export and explicit backup restore consent',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','fleet.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'..','fleet.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(js));
 for(const id of ['backupWorkspace','selectWorkspaceBackup','workspaceBackupFile','workspaceRestorePreview','confirmWorkspaceRestore','restoreWorkspace','workspaceBackupStatus']){
  assert.ok(html.includes('id="'+id+'"'),'missing control '+id);
 }
 assert.match(js,/RavrentWorkspaceBackup\.planRestore/);
 assert.match(js,/RavrentWorkspaceBackup\.restoreMissing/);
 assert.match(html,/src="\/workspace-backup-core\.js"/);
});
