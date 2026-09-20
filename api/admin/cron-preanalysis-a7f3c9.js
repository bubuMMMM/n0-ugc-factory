const core=require('./_preanalysis-core');
const JOB_ID='e3f5da69-0a8f-454b-af36-8bd58a591e6c';

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.headers['x-vercel-cron-schedule']!=='* * * * *')return res.status(403).json({error:'CRON_ONLY'});
  try{
    const job=await core.getJob(JOB_ID);
    if(!job||!job.active)return res.status(200).json({done:true,active:false});
    const result=await core.runBatch(JOB_ID);
    return res.status(200).json({
      done:Boolean(result.stop),
      counts:result.counts||await core.counts(),
      saved:(result.saved||[]).map(x=>x.index),
      lastError:result.lastError||null
    });
  }catch(error){
    console.error('cron-preanalysis-a7f3c9',error&&error.message,error&&error.detail||'');
    return res.status(500).json({error:String(error&&error.message||'CRON_BATCH_FAILED')});
  }
};
