// Public readiness check. Returns only booleans and model ID, never secrets.
module.exports = function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'});}
  return res.status(200).json({
    configured:Boolean(process.env.GEMINI_API_KEY&&process.env.MECHANIC_ACCESS_CODE),
    model:process.env.GEMINI_MODEL||'gemini-3.8-flash',
    researchAvailable:true,
    notice:'Configured means both settings are present; an actual AI request is still needed to verify credentials.'
  });
};