(function(root){'use strict';
// Standalone local workspace portability. Never touches API keys or subscription state.
const FORMAT='ravrent-workspace',VERSION=1,MAX_BYTES=8*1024*1024;
const DATASETS=[
 ['ravrent-mechanic-v2','Garage, chats and saved reports','object'],
 ['ravrent_service_schedule_v1','Service schedule and odometer notes','object'],
 ['ravrent_repair_cases_v1','Garage repair cases','array'],
 ['ravrent_diagnostic_casebook_v1','Diagnostic Casebook','array'],
 ['ravrent_workshop_estimates_v1','Workshop quotes','array'],
 ['ravrent_workshop_templates_v1','Workshop templates','array'],
 ['ravrent_reseller_inventory_v1','Reseller inventory','array'],
 ['ravrent_toolkit_v1','Ownership Toolkit','object'],
 ['ravrent_shop_planning_v1','Shop planning assumptions','object'],
 ['ravrent_fleet_annotations_v1','Fleet statuses and assignment notes','object']
];
const allowed=new Map(DATASETS.map(([key,label,type])=>[key,{label,type}]));
function bytes(text){return typeof TextEncoder!=='undefined'?new TextEncoder().encode(text).length:text.length}
function acceptable(key,data){
 const definition=allowed.get(key);if(!definition)return false;
 if(definition.type==='array')return Array.isArray(data);
 if(definition.type==='object')return Boolean(data)&&typeof data==='object'&&!Array.isArray(data);
 return false;
}
function exportData(storage){
 const datasets={};let omitted=0;
 for(const [key] of DATASETS){
  let raw;try{raw=storage.getItem(key)}catch{continue}
  if(!raw)continue;
  try{
   const value=JSON.parse(raw);
   if(!acceptable(key,value)){omitted++;continue}
   datasets[key]=value;
  }catch{omitted++}
 }
 const payload={app:'ravrent-mechanic',format:FORMAT,version:VERSION,createdAt:new Date().toISOString(),datasets};
 const content=JSON.stringify(payload,null,2);
 if(bytes(content)>MAX_BYTES)throw Error('This workspace is larger than the 8 MB combined-backup limit. Use the individual tools to export large records.');
 return {payload,content,count:Object.keys(datasets).length,omitted};
}
function validateBackup(payload){
 if(!payload||payload.app!=='ravrent-mechanic'||payload.format!==FORMAT||payload.version!==VERSION||!payload.datasets||typeof payload.datasets!=='object'||Array.isArray(payload.datasets))throw Error('This is not a supported Ravrent workspace backup.');
 const keys=Object.keys(payload.datasets);
 if(!keys.length)throw Error('This backup contains no application records.');
 if(keys.length>DATASETS.length)throw Error('The backup has unsupported additional record types.');
 let total=0;
 for(const key of keys){
  if(!acceptable(key,payload.datasets[key]))throw Error('The backup contains invalid records: '+key);
  total+=bytes(JSON.stringify(payload.datasets[key]));
  if(total>MAX_BYTES)throw Error('The backup exceeds 8 MB. Restore records from smaller individual backups.');
 }
 return {keys,labels:keys.map(k=>allowed.get(k).label),createdAt:typeof payload.createdAt==='string'?payload.createdAt:''}
}
function planRestore(payload,storage){
 const verified=validateBackup(payload),importable=[],existing=[];
 for(const key of verified.keys){
  let found=null;try{found=storage.getItem(key)}catch{throw Error('Browser storage is unavailable.')}
  if(found!==null&&found!=='')existing.push(key);
  else importable.push(key)
 }
 return {...verified,importable,existing};
}
function restoreMissing(payload,storage){
 const plan=planRestore(payload,storage);
 if(!plan.importable.length)return {restored:[],skipped:plan.existing};
 const written=[];
 try{
  for(const key of plan.importable){
   storage.setItem(key,JSON.stringify(payload.datasets[key]));
   written.push(key)
  }
 }catch{
  for(const key of written){try{storage.removeItem(key)}catch{}}
  throw Error('Browser storage could not save the backup. No existing records were overwritten; partial imports were rolled back where supported.')
 }
 return {restored:written,skipped:plan.existing}
}
const api={DATASETS,MAX_BYTES,exportData,validateBackup,planRestore,restoreMissing};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.RavrentWorkspaceBackup=api;
})(typeof window!=='undefined'?window:null);
