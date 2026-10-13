'use strict';
// Low-cost open-weight serverless inference; never expose credentials to browsers.
const {convertMessages,compactMessages,parseRetryAfter}=require('./groq-provider');
const API='https://api.together.xyz/v1/chat/completions';
const MODELS='https://api.together.xyz/v1/models';
const DEFAULT_MODEL='Qwen/Qwen3.8-Flash';
function safeError(status,headers){
 const retryAfterSeconds=status===429?parseRetryAfter(headers):null;
 if(status===401)return {code:'TOGETHER_KEY_INVALID',message:'Together AI rejected the API key. Verify TOGETHER_API_KEY in Vercel.'};
 if(status===402)return {code:'TOGETHER_BILLING_REQUIRED',message:'Together AI requires billing or credits before this model can be used.'};
 if(status===403)return {code:'TOGETHER_PERMISSION',message:'This Together account cannot access the requested model.'};
 if(status===429)return {code:'AI_QUOTA',message:'Together AI is rate limited. Check the provider limits and retry shortly.',retryAfterSeconds,rateLimitScope:'provider'};
 if(status===400||status===413)return {code:'TOGETHER_BAD_REQUEST',message:'The provider did not accept this request. Try a shorter message or smaller photo.'};
 if(status===404)return {code:'TOGETHER_MODEL_UNAVAILABLE',message:'The selected Together AI model is not available on this account.'};
 return {code:'TOGETHER_UNAVAILABLE',message:'Together AI could not generate an answer. Try again later.'}
}
async function callTogether({key,contents,vehiclePrompt,deep=false,requestedResearch=false,signal,fetcher=fetch,model=DEFAULT_MODEL}){
 if(!/^[a-zA-Z0-9][a-zA-Z0-9/_:.-]{3,130}$/.test(model))return {ok:false,status:503,code:'TOGETHER_MODEL_CONFIG',message:'Together model selection is invalid.'};
 const converted=convertMessages(contents);
 if(converted.error)return {ok:false,status:400,code:converted.error,message:converted.error==='VIDEO_UNSUPPORTED'?'Videos must be converted into visible still frames first.':converted.error==='INVALID_IMAGE'?'Invalid or oversized photo.':'Please review the message and attachments.'};
 const messages=[{role:'system',content:String(vehiclePrompt||'').slice(0,3600)},...compactMessages(converted.messages,{deep})];
 const response=await fetcher(API,{method:'POST',signal,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({model,messages,max_tokens:deep?1250:700,temperature:.35})
 });
 if(!response.ok)return {ok:false,status:response.status,...safeError(response.status,response.headers)};
 const result=await response.json();
 const answer=result?.choices?.[0]?.message?.content;
 if(typeof answer!=='string'||!answer.trim())return {ok:false,status:503,code:'TOGETHER_EMPTY',message:'The provider returned no usable answer.'};
 const input=Number(result?.usage?.prompt_tokens),output=Number(result?.usage?.completion_tokens);
 return {ok:true,status:200,provider:'Together AI',reply:answer.slice(0,17000),model,
  researchRequested:requestedResearch,researchPerformed:false,sources:[],
  researchNote:requestedResearch?'Live web search was not performed. Verify current recall, pricing, and repair information separately.':null,
  mode:deep?'Deep diagnosis':'Quick response',modelParts:[],
  usage:{inputTokens:Number.isFinite(input)&&input>=0?input:null,outputTokens:Number.isFinite(output)&&output>=0?output:null}};
}
async function checkTogetherModels({key,signal,fetcher=fetch,model=DEFAULT_MODEL}){
 const response=await fetcher(MODELS,{signal,headers:{Authorization:'Bearer '+key,Accept:'application/json'}});
 if(!response.ok)return {provider:'Together AI',status:'failed',...safeError(response.status,response.headers)};
 const body=await response.json(),models=Array.isArray(body)?body:Array.isArray(body?.data)?body.data:[];
 const modelsListed=models.some(x=>x?.id===model);
 return {provider:'Together AI',status:'provider_access_ok',code:'MODEL_LIST_PASSED',
  standardModel:model,standardModelListed:modelsListed,deepModel:model,deepModelListed:modelsListed,
  note:'A live generated reply is still required to verify inference and billing.'};
}
module.exports={callTogether,checkTogetherModels,safeError,DEFAULT_MODEL};
