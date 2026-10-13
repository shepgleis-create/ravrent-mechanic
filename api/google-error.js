'use strict';
// Common provider-error classification, never exposing provider response, key, or project IDs.
function classifyGoogleError(status,body){
 const e=body&&typeof body.error==='object'?body.error:{};
 const reason=[...(Array.isArray(e.details)?e.details:[])]
  .map(x=>String(x?.reason||'').slice(0,80).toUpperCase()).filter(Boolean).join(' ');
 const message=String(e.message||'').slice(0,800).toLowerCase();
 const keyReason=/API_KEY_INVALID|API_KEY_EXPIRED|API_KEY_NOT_FOUND|INVALID_API_KEY/.test(reason)||/(api key|apikey).{0,80}(invalid|expired|not valid|revoked)/.test(message);
 const leaked=/API_KEY_BLOCKED|API_KEY_SERVICE_BLOCKED|API_KEY_LEAKED|LEAKED_API_KEY/.test(reason)||/(key was reported as leaked|key has been blocked|unrestricted api key|legacy api key|dormant api key)/.test(message);
 const restricted=/API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|API_KEY_SERVICE_BLOCKED|API_KEY_ANDROID_APP_BLOCKED|API_KEY_IOS_APP_BLOCKED|API_KEY_APP_BLOCKED|API_KEY_RESTRICTION/.test(reason)||/(api key restrictions|referrer|ip address|service blocked|application restriction)/.test(message);
 const denied=/PROJECT_DENIED_ACCESS|CONSUMER_SUSPENDED|PROJECT_BLOCKED|PROJECT_SUSPENDED/.test(reason)||/(project has been denied access|project.+suspended|account.+denied access|project.+blocked)/.test(message);
 const disabled=/SERVICE_DISABLED|API_DISABLED|SERVICE_NOT_ENABLED/.test(reason)||/(api has not been used|api.+disabled|service disabled|enable.+generative language api)/.test(message);
 const billing=/BILLING_DISABLED|BILLING_NOT_ENABLED|BILLING_REQUIRED|INSUFFICIENT_PREPAY_CREDITS/.test(reason)||/(billing|prepay credits|payment required|add funds)/.test(message);
 const model=/MODEL_NOT_FOUND|MODEL_PERMISSION_DENIED|MODEL_NOT_SUPPORTED/.test(reason)||/(model.{0,90}(permission|access denied|not available|not found|does not exist)|permission.{0,90}model)/.test(message);
 let code='AI_PROVIDER_ERROR',action='The AI provider rejected the request. Check your project and model access in Google AI Studio.';
 if(status===429||/RESOURCE_EXHAUSTED|RATE_LIMIT_EXCEEDED|QUOTA_EXCEEDED/.test(reason)){code='AI_QUOTA';action='Check Gemini model quotas, rate limits and billing in Google AI Studio.'}
 else if(denied){code='AI_PROJECT_BLOCKED';action='Google denied project or account access. Check AI Studio project warnings and contact Google AI support or appeal; changing Ravrent code cannot unblock it.'}
 else if(disabled){code='AI_API_DISABLED';action='Enable the Gemini / Generative Language API for the key\'s project in Google AI Studio or Cloud Console.'}
 else if(billing){code='AI_BILLING';action='Check the Google AI Studio billing balance and payment setup for this project.'}
 else if(keyReason){code='AI_KEY_INVALID';action='Create a valid Gemini API key in Google AI Studio and update the server-side GEMINI_API_KEY in Vercel.'}
 else if(leaked){code='AI_KEY_BLOCKED';action='Google blocked this key. Create a new Gemini API key in AI Studio, restrict it to Gemini API, then update GEMINI_API_KEY in Vercel.'}
 else if(restricted){code='AI_KEY_RESTRICTED';action='Create a server-compatible Gemini API key in AI Studio, restricted to Gemini API. Browser-referrer-restricted keys do not work for server calls.'}
 else if(model){code='AI_MODEL_ACCESS';action='Use a Gemini model allowed by this project, then test with a real generation request.'}
 else if(status===401||status===403){code='AI_PERMISSION';action='Google returned a permission denial. Check whether your key is a supported Gemini key, restricted to the Gemini API, and whether the Google project is allowed.'}
 else if(status===404){code='AI_MODEL';action='The selected Gemini model or API endpoint is unavailable. Verify the model name.'}
 else if(status===400){code='AI_BAD_REQUEST';action='The provider rejected the model request format. Try without search and advanced options.'}
 else if(status>=500){code='AI_PROVIDER_DOWN';action='Google returned a temporary server error. Retry after a short delay.'}
 return {code,action,providerStatus:Number(status)||0};
}
module.exports={classifyGoogleError};
