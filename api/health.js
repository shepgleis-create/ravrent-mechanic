// Public server health - no paid model request, secrets or private account details.
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 const choice=String(process.env.AI_PROVIDER||'auto').toLowerCase();
 const groqKey=Boolean(process.env.GROQ_API_KEY),togetherKey=Boolean(process.env.TOGETHER_API_KEY);
 const together=choice==='together'||(choice==='auto'&&!groqKey&&togetherKey);
 const groq=!together&&(choice==='groq'||(choice!=='gemini'&&groqKey));
 const hasKey=together?togetherKey:groq?groqKey:Boolean(process.env.GEMINI_API_KEY);
 // Presence alone DOES NOT verify billing, key validity or model availability.
 return res.status(200).json({
   server:'online',
   assistant:process.env.AI_REQUESTS_ENABLED==='false'?'paused_by_owner':(hasKey?'configured_unverified':'not_configured'),
   uploadRoutes:!groq&&!together,
   providerTested:false,
   build:'diagnostics-v3',
   time:new Date().toISOString()
 });
};