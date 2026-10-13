'use strict';
// GroqCloud runs open-weight models. Credentials remain server-side.
// This adapter deliberately does not claim video, web search or VIN-history coverage.
const TEXT_MODEL='qwen/qwen3.8-27b';
const VISION_MODEL='qwen/qwen3.8-27b';
const MODELS_URL='https://api.groq.com/openai/v1/models';
const CHAT_URL='https://api.groq.com/openai/v1/chat/completions';
const validModel=id=>/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{1,110}$/.test(id);
function convertMessages(contents){
 const messages=[];
 let imageCount=0,hasImage=false,hasVideo=false;
 for(const item of contents){
  if(!item||!Array.isArray(item.parts))continue;
  if(item.role==='model'){
   const body=item.parts.filter(p=>p&&typeof p.text==='string').map(p=>p.text).join('\n').slice(0,11000);
   if(body.trim())messages.push({role:'assistant',content:body});
   continue;
  }
  if(item.role!=='user')continue;
  const chunks=[];
  for(const part of item.parts){
   if(part&&typeof part.text==='string'&&part.text.trim())chunks.push({type:'text',text:part.text.slice(0,3200)});
   if(part?.file_data)hasVideo=true;
   if(part?.inline_data){
    const image=part.inline_data;
    if(!/^image\/(jpeg|png|webp)$/.test(image.mime_type)||typeof image.data!=='string'||image.data.length>2500000)return {error:'INVALID_IMAGE'};
    if(++imageCount>3)return {error:'TOO_MANY_IMAGES'};
    chunks.push({type:'image_url',image_url:{url:'data:'+image.mime_type+';base64,'+image.data}});
    hasImage=true;
   }
  }
  if(chunks.length)messages.push({role:'user',content:chunks.length===1&&chunks[0].type==='text'?chunks[0].text:chunks});
 }
 if(hasVideo)return {error:'VIDEO_UNSUPPORTED'};
 if(!messages.length||messages[messages.length-1].role!=='user')return {error:'BAD_MESSAGES'};
 return {messages,hasImage,imageCount};
}
function providerError(status,body){
 const info=String(body?.error?.message||'').slice(0,240).toLowerCase();
 if(status===401)return {code:'GROQ_KEY_INVALID',message:'Groq rejected the server API key. Replace GROQ_API_KEY in Vercel.'};
 if(status===403)return {code:'GROQ_PERMISSION',message:'Groq denied access to this model or organization. Check your GroqCloud account and permissions.'};
 if(status===429)return {code:'AI_QUOTA',message:'Groq rate or usage limits were reached. Wait for reset or review your Groq account limits.'};
 if(status===404||(/model/.test(info)&&status===400))return {code:'GROQ_MODEL_UNAVAILABLE',message:'The selected Groq model is unavailable to this account. Choose a supported model.'};
 if(status===400||status===413)return {code:'GROQ_BAD_REQUEST',message:'Groq rejected the message or image format. Try a shorter text-only question.'};
 if(status>=500)return {code:'GROQ_UNAVAILABLE',message:'Groq is temporarily unavailable. Retry later.'};
 return {code:'GROQ_ERROR',message:'The AI provider could not complete this request.'};
}
async function callGroq({key,contents,vehiclePrompt,deep=false,requestedResearch=false,signal,fetcher=fetch,standardModel=TEXT_MODEL,visionModel=VISION_MODEL}){
 const converted=convertMessages(contents);
 if(converted.error){
  const errors={
   INVALID_IMAGE:'The photo format is invalid. Use a JPEG, PNG or WebP image.',
   TOO_MANY_IMAGES:'Attach no more than three photos to an AI request.',
   VIDEO_UNSUPPORTED:'This AI provider does not read Google-uploaded video files. Use still frames or describe the sound and symptoms.',
   BAD_MESSAGES:'The chat message could not be read.'
  };
  return {ok:false,status:400,code:converted.error,message:errors[converted.error]};
 }
 const model=converted.hasImage?visionModel:standardModel;
 if(!validModel(model))return {ok:false,status:503,code:'MODEL_CONFIG',message:'Groq model configuration is invalid.'};
 const chat=[{role:'system',content:String(vehiclePrompt||'').slice(0,10000)},...converted.messages];
 const maxTokens=deep?2900:1600;
 async function run(modelId){
  const response=await fetcher(CHAT_URL,{
   method:'POST',signal,
   headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({model:modelId,messages:chat,temperature:modelId===VISION_MODEL?(deep?1:0.7):0.4,max_completion_tokens:maxTokens,...(modelId===VISION_MODEL?{reasoning_effort:deep?'medium':'none',reasoning_format:'hidden'}:{})})
  });
  if(!response.ok){
   let body={};try{body=await response.json()}catch{}
   return {ok:false,status:response.status,...providerError(response.status,body)};
  }
  let output={};try{output=await response.json()}catch{}
  const answer=output?.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim())return {ok:false,status:503,code:'EMPTY_RESPONSE',message:'The open-weight model returned no usable answer.'};
  return {ok:true,status:200,model:modelId,reply:answer.slice(0,17000)};
 }
 let result=await run(model);
 let usedFallback=false;
 // A model that is removed or access-restricted must not take text chat offline.
 // Never silently substitute a text-only model for a vehicle photograph.
 if(!result.ok&&!converted.hasImage&&result.code==='GROQ_MODEL_UNAVAILABLE'&&model!==TEXT_MODEL){
  result=await run(TEXT_MODEL);usedFallback=true;
 }
 if(!result.ok)return result;
 return {ok:true,status:200,provider:'Groq',reply:result.reply,model:result.model,
  researchRequested:requestedResearch,researchPerformed:false,sources:[],
  researchNote:requestedResearch?'Live web search is not connected to this open-weight model. This answer uses general automotive knowledge and the details you supplied.':null,
  mode:deep?'Deep diagnosis':'Quick response',modelParts:[],usedFallback};
}
async function checkGroqModels({key,fetcher=fetch,signal,standardModel=TEXT_MODEL,visionModel=VISION_MODEL}){
 const response=await fetcher(MODELS_URL,{signal,headers:{Authorization:'Bearer '+key,Accept:'application/json'}});
 if(!response.ok){let json={};try{json=await response.json()}catch{}
  return {status:'failed',provider:'Groq',...providerError(response.status,json)}
 }
 const body=await response.json();
 if(!Array.isArray(body.data))return {status:'unknown',provider:'Groq',code:'INVALID_RESPONSE',message:'Groq returned an unexpected model list.'};
 const ids=new Set(body.data.filter(x=>x&&typeof x.id==='string').map(x=>x.id));
 return {status:'provider_access_ok',provider:'Groq',code:'MODEL_LIST_PASSED',
  standardModel,standardModelListed:ids.has(standardModel),deepModel:visionModel,deepModelListed:ids.has(visionModel),
  note:'Groq accepted model listing. A real chat and photo request must still be tested separately.'};
}
module.exports={callGroq,checkGroqModels,convertMessages,providerError,TEXT_MODEL,VISION_MODEL};
