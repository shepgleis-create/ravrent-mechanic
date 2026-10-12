// Non-secret readiness status for the embedded automotive assistant.
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET required'});}
 return res.status(200).json({configured:Boolean(process.env.GEMINI_API_KEY)});
};