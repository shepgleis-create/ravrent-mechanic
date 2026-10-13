// Non-secret readiness status for the embedded automotive assistant.
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 const preference=String(process.env.AI_PROVIDER||'auto').toLowerCase();
 const groq=Boolean(String(process.env.GROQ_API_KEY||'').trim());
 const gemini=Boolean(String(process.env.GEMINI_API_KEY||'').trim());
 const together=Boolean(String(process.env.TOGETHER_API_KEY||'').trim());
 const provider=preference==='together'||(preference==='auto'&&!groq&&together)?'Together AI':
  preference==='groq'||(preference!=='gemini'&&groq)?'Groq':'Gemini';
 return res.status(200).json({
  configured:provider==='Together AI'?together:provider==='Groq'?groq:gemini,provider,
  groqConfigured:groq,togetherConfigured:together,geminiConfigured:gemini,
  paused:process.env.AI_REQUESTS_ENABLED==='false',
  setupRequired:!groq&&!together&&preference!=='gemini',
  setupProvider:!groq&&!together&&preference!=='gemini'?'Groq':null,
  setupMessage:!groq&&!together&&preference!=='gemini'?
   'Groq is not activated yet. Create a GroqCloud API key, add GROQ_API_KEY to Vercel Production environment variables, and redeploy. Until then the app uses the configured Gemini provider.':
   null
 });
};