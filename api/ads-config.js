// Public advertising configuration. No paid ads run until the site owner
// explicitly enables them after publisher approval and consent setup.
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=120');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'});}
 const pub=String(process.env.ADSENSE_PUBLISHER_ID||'');
 const enabled=process.env.ADSENSE_ENABLED==='true'&&/^ca-pub-\d{16}$/.test(pub);
 return res.status(200).json({enabled,publisherId:enabled?pub:null});
};