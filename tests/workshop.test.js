const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../workshop-core');
const html=fs.readFileSync(path.join(__dirname,'..','workshop.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','workshop.js'),'utf8');
const currency=n=>Math.round(n*100)/100;
const example={
 items:[
  {kind:'labor',description:'Two diagnostic hours',quantity:2,unitPrice:95,internalCost:45,taxable:false},
  {kind:'part',description:'Replacement part',quantity:1,unitPrice:125,internalCost:80,taxable:true}
 ],taxRate:8.25,discount:15,depositPercent:20
};
test('workshop quote computes itemized subtotal, selective tax, deposit and gross margin',()=>{
 const c=core.calculate(example);
 assert.equal(c.subtotal,315);
 assert.equal(c.beforeTax,300);
 assert.equal(c.tax,9.82);
 assert.equal(c.total,309.82);
 assert.equal(c.deposit,61.96);
 assert.equal(c.internalCost,170);
 assert.equal(c.estimatedGrossMargin,130);
 assert.equal(c.taxableBeforeDiscount,125)
});
test('workshop math blocks nonsensical discounts, negative charges and unsupported tax',()=>{
 assert.throws(()=>core.calculate({...example,discount:400}),/Discount cannot exceed/);
 assert.throws(()=>core.calculate({...example,taxRate:55}),/Invalid discount/);
 assert.throws(()=>core.calculate({...example,items:[{quantity:1,unitPrice:-200,internalCost:0,taxable:true}]}),/nonnegative/);
 assert.throws(()=>core.calculate({...example,depositPercent:101}),/Invalid discount/)
});
test('workshop UI provides real forms, export, print, quote stages and no external checkout',()=>{
 assert.doesNotThrow(()=>new vm.Script(app));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 for(const id of ['quoteDialog','quoteForm','createQuote','quoteLines','quoteTax','quoteDiscount','quoteDeposit','customerTotal','marginTotal','quoteStage','backupQuotes','restoreQuotesButton','printQuote','workshopPrint']){
  assert.ok(ids.includes(id),'missing '+id)
 }
 assert.equal(ids.length,new Set(ids).size,'duplicate DOM ids');
 const selectors=[...app.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 for(const id of selectors)assert.ok(ids.includes(id),'missing referenced control '+id);
 assert.doesNotMatch(html,/<a[^>]*href="https?:/i);
 assert.doesNotMatch(html,/checkout\.stripe\.com/i);
});
