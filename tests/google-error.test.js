const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {classifyGoogleError}=require('../lib/google-error');
const at=(message,reason='')=>({error:{status:'PERMISSION_DENIED',message,details:reason?[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason}]:[]}});
test('Google project block is diagnosed without exposing provider identifiers',()=>{
 const detail=classifyGoogleError(403,at('Your project has been denied access. Please contact support. Project 123abc'));
 assert.equal(detail.code,'AI_PROJECT_BLOCKED');
 assert.doesNotMatch(JSON.stringify(detail),/123abc/);
 assert.match(detail.action,/Google AI support/);
});
test('legacy, leaked and API-blocked keys are not labeled quota failures',()=>{
 const legacy=classifyGoogleError(403,at('Unrestricted API key is not allowed'));
 const blocked=classifyGoogleError(403,at('The API key was reported as leaked.','API_KEY_SERVICE_BLOCKED'));
 assert.equal(legacy.code,'AI_KEY_BLOCKED');
 assert.equal(blocked.code,'AI_KEY_BLOCKED');
 assert.doesNotMatch(blocked.action,/usage limit/);
});
test('provider ErrorInfo catches API disabled, restricted keys and invalid keys',()=>{
 assert.equal(classifyGoogleError(403,at('Permission denied','SERVICE_DISABLED')).code,'AI_API_DISABLED');
 assert.equal(classifyGoogleError(403,at('Request rejected','API_KEY_HTTP_REFERRER_BLOCKED')).code,'AI_KEY_RESTRICTED');
 assert.equal(classifyGoogleError(403,at('API key not valid','API_KEY_INVALID')).code,'AI_KEY_INVALID');
 assert.equal(classifyGoogleError(403,at('Forbidden','BILLING_REQUIRED')).code,'AI_BILLING');
 assert.equal(classifyGoogleError(429,at('quota exceeded','RESOURCE_EXHAUSTED')).code,'AI_QUOTA');
});
test('simplified diagnostics UI contains no health cards and no false key-verification badge',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const start=html.indexOf('<section id="healthPane"');
 const end=html.indexOf('<section id="reportsPane"',start);
 const part=html.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.doesNotMatch(part,/item-card|callout|grid-template-columns/);
 for(const id of ['aiConnectionHeadline','aiConnectionDetail','runHealth','checkProvider','runLiveAiTest','healthResults']){
  assert.match(part,new RegExp('id="'+id+'"'));
 }
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const checks=fs.readFileSync(path.join(__dirname,'..','diagnostic-tools.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(app));
 assert.doesNotThrow(()=>new vm.Script(checks));
 assert.doesNotMatch(app,/The previous request reached its usage limit/);
 assert.match(app,/AI offline/);
 assert.match(checks,/status-fail/);
});
