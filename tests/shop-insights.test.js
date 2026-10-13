const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {estimate,requiredLaborRate}=require('../shop-insights-core');
const sample=[
 {quoteStage:'draft',created:'2026-10-01T10:00:00Z',items:[{kind:'labor',quantity:1,unitPrice:20,internalCost:5,taxable:false}]},
 {quoteStage:'quoted',created:'2026-10-02T10:00:00Z',items:[{kind:'labor',quantity:2,unitPrice:100,internalCost:50,taxable:false}]},
 {quoteStage:'approved',created:'2026-10-03T10:00:00Z',items:[{kind:'part',quantity:1,unitPrice:220,internalCost:150,taxable:false}]},
 {quoteStage:'completed',created:'2026-10-04T10:00:00Z',items:[{kind:'labor',quantity:2,unitPrice:85,internalCost:35,taxable:false},{kind:'part',quantity:1,unitPrice:100,internalCost:60,taxable:true}],quoteTax:'8.25',quoteDiscount:'10'}
];
test('shop pipeline excludes drafts from issued quotes and completed from open pipeline',()=>{
 const m=estimate(sample,0,new Date('2026-10-12').valueOf());
 assert.equal(m.issued,3);
 assert.equal(m.approved,2);
 assert.equal(m.openValue,420);
 assert.equal(m.completedValue,268.58);
 assert.equal(m.approvalRate,66.67);
 assert.equal(m.estimatedGrossMargin,130);
 assert.equal(m.mix.labor.cost,70);
 assert.equal(m.mix.part.cost,60);
});
test('shop labor-rate estimator respects monthly overhead, direct labor and parts margin',()=>{
 const m=requiredLaborRate({overhead:4500,targetProfit:2500,billableHours:140,laborCostPerHour:32,partsGrossProfit:2100});
 assert.equal(m.totalNeeded,7000);
 assert.equal(m.laborContribution,4900);
 assert.equal(m.requiredPerHour,35);
 assert.equal(m.rate,67);
});
test('shop economics rejects missing hours, negative inputs and excessive hourly cost',()=>{
 assert.throws(()=>requiredLaborRate({overhead:1200,billableHours:0}),/billable hours/);
 assert.throws(()=>requiredLaborRate({overhead:-50,billableHours:100}),/valid nonnegative/);
 assert.throws(()=>requiredLaborRate({overhead:1200,billableHours:80,laborCostPerHour:10000000}),/Labor cost/);
});
test('shop analytics frontend is safe and connected to local workshop estimates',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','shop-insights.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'..','shop-insights.js'),'utf8');
 const core=fs.readFileSync(path.join(__dirname,'..','shop-insights-core.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.doesNotThrow(()=>new vm.Script(core));
 for(const id of ['pipelineRows','requiredRate','perHourContribution','exportInsight','issuedCount','completedValue','marginLines','period']){
  assert.ok(html.includes('id="'+id+'"'),'missing analytics control '+id);
 }
 assert.match(js,/ravrent_workshop_estimates_v1/);
 assert.match(html,/\bnot verified payments\b|Not verified payments/i);
 assert.doesNotMatch(html,/<a[^>]+href="https?:/i);
});
