const core=require('./_preanalysis-core');
const {isCron}=require('./_auth');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!isCron(req))return res.status(401).json({error:'UNAUTHORIZED'});
  try{
    const job=await core.latestActiveJob();
    if(!job)return res.status(200).json({done:true,active:false});
    const result=await core.runBatch(job.id);
    return res.status(200).json({
      done:Boolean(result.stop),paused:Boolean(result.paused),jobId:job.id,
      counts:result.counts||await core.counts(),
      saved:(result.saved||[]).map(x=>x.index),
      lastError:result.lastError||null
    });
  }catch(error){
    console.error('cron-preanalysis-b4e812',error&&error.message,error&&error.detail||'');
    return res.status(500).json({error:String(error&&error.message||'CRON_BATCH_FAILED')});
  }
};
