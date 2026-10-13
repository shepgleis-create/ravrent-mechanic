// Public ad placements are intentionally OFF until publisher and privacy gates are confirmed.
// The site must not load ad scripts or show empty ad frames before approval.
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'});}
 const pub=String(process.env.ADSENSE_PUBLISHER_ID||'').trim();
 const guideSlot=String(process.env.ADSENSE_GUIDE_SLOT||'').trim();
 const validPublisher=/^ca-pub-\d{16}$/.test(pub);
 const validSlot=/^\d{5,25}$/.test(guideSlot);
 const approved=process.env.ADSENSE_APPROVED==='true';
 const privacyReady=process.env.ADSENSE_CONSENT_READY==='true';
 const requested=process.env.ADSENSE_ENABLED==='true';
 const enabled=Boolean(requested&&approved&&privacyReady&&validPublisher&&validSlot);
 return res.status(200).json({
  enabled,
  publisherId:enabled?pub:null,
  placements:enabled?{guides:guideSlot}: {},
  state:enabled?'ready':!requested?'disabled':!approved?'pending_approval':!privacyReady?'consent_configuration_required':!validPublisher||!validSlot?'missing_publisher_or_slot':'disabled',
  scope:'Public original automotive guides only; never diagnostic chat, input forms, VIN or safety warnings.'
 });
};