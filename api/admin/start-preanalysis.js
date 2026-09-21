const {isAdmin,adminConfigured}=require('./_auth');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  }
  if(!adminConfigured())return res.status(503).json({error:'ADMIN_AUTH_NOT_CONFIGURED'});
  if(!isAdmin(req))return res.status(401).json({error:'UNAUTHORIZED'});
  return res.status(409).json({error:'OFFLINE_PREANALYSIS_ONLY',message:'La préanalyse du catalogue est effectuée hors ligne, sans API de modèle.'});
};
