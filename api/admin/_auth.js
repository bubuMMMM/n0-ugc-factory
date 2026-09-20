const crypto=require('node:crypto');

function configuredSecret(name){return String(process.env[name]||'').trim()}
function bearer(req){
  const raw=String(req.headers&&req.headers.authorization||'');
  const m=raw.match(/^Bearer\s+(.+)$/i);
  return m?m[1].trim():'';
}
function safeEqual(a,b){
  a=String(a||'');b=String(b||'');
  if(!a||!b)return false;
  const ah=crypto.createHash('sha256').update(a).digest();
  const bh=crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ah,bh);
}
function isCron(req){
  const secret=configuredSecret('CRON_SECRET');
  return Boolean(secret)&&safeEqual(bearer(req),secret);
}
function isAdmin(req){
  const secret=configuredSecret('PREANALYZE_SECRET')||configuredSecret('CRON_SECRET');
  const supplied=bearer(req)||String(req.headers&&req.headers['x-preanalysis-token']||'');
  return Boolean(secret)&&safeEqual(supplied,secret);
}
function adminConfigured(){
  return Boolean(configuredSecret('PREANALYZE_SECRET')||configuredSecret('CRON_SECRET'));
}
module.exports={isCron,isAdmin,adminConfigured};
