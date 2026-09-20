const core=require('./_preanalysis-core');
const {isAdmin,adminConfigured}=require('./_auth');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!adminConfigured())return res.status(503).json({error:'ADMIN_AUTH_NOT_CONFIGURED'});
  if(!isAdmin(req))return res.status(401).json({error:'UNAUTHORIZED'});
  const jobId=String(req.body&&req.body.job||'');
  if(!/^[0-9a-f-]{36}$/i.test(jobId))return res.status(400).json({error:'INVALID_JOB'});
  try{
    const job=await core.getJob(jobId);
    if(!job)return res.status(404).json({error:'JOB_NOT_FOUND'});
    if(!job.active){
      const counts=await core.counts();
      return res.status(200).json({active:false,done:true,jobId,counts});
    }
    const result=await core.runBatch(jobId);
    const current=await core.getJob(jobId);
    return res.status(200).json({
      active:Boolean(current&&current.active),
      done:Boolean(result.stop),
      jobId,
      saved:result.saved||[],
      counts:result.counts||await core.counts(),
      lastError:result.lastError||null
    });
  }catch(error){
    console.error('process-preanalysis-batch',error&&error.message,error&&error.detail||'');
    return res.status(500).json({error:String(error&&error.message||'BATCH_FAILED')});
  }
};