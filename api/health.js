// Public server health - no paid model request, secrets or private account details.
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 const choice=String(process.env.AI_PROVIDER||'auto').toLowerCase();
 const groq=choice==='groq'||(choice!=='gemini'&&Boolean(process.env.GROQ_API_KEY));
 const hasKey=groq?Boolean(process.env.GROQ_API_KEY):Boolean(process.env.GEMINI_API_KEY);
 // Presence alone DOES NOT verify billing, key validity or model availability.
 return res.status(200).json({
   server:'online',
   assistant:process.env.AI_REQUESTS_ENABLED==='false'?'paused_by_owner':(hasKey?'configured_unverified':'not_configured'),
   uploadRoutes:!groq,
   providerTested:false,
   build:'diagnostics-v3',
   time:new Date().toISOString()
 });
};