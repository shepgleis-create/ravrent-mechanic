// Non-secret readiness status for the embedded automotive assistant.
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 const preference=String(process.env.AI_PROVIDER||'auto').toLowerCase();
 const groq=Boolean(String(process.env.GROQ_API_KEY||'').trim());
 const gemini=Boolean(String(process.env.GEMINI_API_KEY||'').trim());
 const provider=preference==='groq'||(preference!=='gemini'&&groq)?'Groq':'Gemini';
 return res.status(200).json({configured:provider==='Groq'?groq:gemini,provider,paused:process.env.AI_REQUESTS_ENABLED==='false'});
};