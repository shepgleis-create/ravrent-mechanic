(function(root){
 'use strict';
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 const money=v=>{if(v===''||v===null||v===undefined)return 0;const n=Number(v);return Number.isFinite(n)&&n>=0?n:NaN};
 const limit=(n,max)=>Number.isFinite(n)&&n>=0&&n<=max;
 function calculate(input){
  const items=Array.isArray(input?.items)?input.items:[];
  let subtotal=0,taxable=0,internal=0;
  for(const item of items){
   const q=money(item.quantity),price=money(item.unitPrice),cost=money(item.internalCost);
   if(!limit(q,10000)||!limit(price,1e6)||!limit(cost,1e6))throw Error('Item amounts must be valid nonnegative numbers.');
   const amount=round(q*price);subtotal=round(subtotal+amount);
   internal=round(internal+round(q*cost));
   if(item.taxable===true)taxable=round(taxable+amount)
  }
  const discount=money(input?.discount),taxRate=money(input?.taxRate),depositPercent=money(input?.depositPercent);
  if(!limit(discount,1e7)||!limit(taxRate,30)||!limit(depositPercent,100))throw Error('Invalid discount, tax or deposit input.');
  if(discount>subtotal)throw Error('Discount cannot exceed the subtotal.');
  const taxableAfterDiscount=subtotal>0?Math.max(0,taxable-discount*(taxable/subtotal)):0;
  const tax=round(taxableAfterDiscount*taxRate/100);
  const beforeTax=round(subtotal-discount);
  const total=round(beforeTax+tax);
  return {subtotal,discount:round(discount),beforeTax,tax,total,deposit:round(total*depositPercent/100),internalCost:internal,estimatedGrossMargin:round(beforeTax-internal),taxableBeforeDiscount:taxable};
 }
 const api={calculate,round};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.RavrentWorkshopCore=api;
})(typeof window!=='undefined'?window:null);
