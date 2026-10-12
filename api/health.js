// Public server health - no paid model request, secrets or private account details.
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 const hasKey=Boolean(process.env.GEMINI_API_KEY);
 // Presence alone DOES NOT verify billing, key validity or model availability.
 return res.status(200).json({
   server:'online',
   assistant:hasKey?'configured_unverified':'not_configured',
   uploadRoutes:true,
   providerTested:false,
   build:'diagnostics-v3',
   time:new Date().toISOString()
 });
};