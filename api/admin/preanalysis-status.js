const core=require('./_preanalysis-core');
const {isAdmin,adminConfigured}=require('./_auth');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!adminConfigured())return res.status(503).json({error:'ADMIN_AUTH_NOT_CONFIGURED'});
  if(!isAdmin(req))return res.status(401).json({error:'UNAUTHORIZED'});
  const jobId=String(req.query&&req.query.job||'');
  if(!/^[0-9a-f-]{36}$/i.test(jobId))return res.status(400).json({error:'INVALID_JOB'});
  try{
    const job=await core.getJob(jobId);
    if(!job)return res.status(404).json({error:'JOB_NOT_FOUND'});
    const counts=await core.counts();
    return res.status(200).json({job,counts,version:core.VERSION,model:core.MODEL,embeddingModel:core.EMBEDDING_MODEL});
  }catch(error){
    return res.status(500).json({error:String(error&&error.message||'STATUS_FAILED')});
  }
};