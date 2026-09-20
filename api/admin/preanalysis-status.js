const core=require('./_preanalysis-core');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
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