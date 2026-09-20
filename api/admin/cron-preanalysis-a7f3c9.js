const core=require('./_preanalysis-core');
const {isCron}=require('./_auth');
const {openaiCredential}=require('../_ai');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!isCron(req))return res.status(401).json({error:'UNAUTHORIZED'});
  try{
    let job=await core.latestActiveJob();

    // Recover exactly the old Gateway-credit pause when a direct OpenAI key is now present.
    if(!job&&openaiCredential()){
      const previous=await core.latestJob();
      const recoverable=!previous||!previous.last_error||previous.last_error==='AI_GATEWAY_INSUFFICIENT_FUNDS';
      if(recoverable){
        const c=await core.counts();
        if(Number(c.pending)+Number(c.errors)>0||Number(c.ready)<Number(c.total)){
          const id=await core.createJob();
          job=await core.getJob(id);
        }
      }
    }

    if(!job)return res.status(200).json({done:true,active:false});
    const result=await core.runBatch(job.id);
    return res.status(200).json({
      done:Boolean(result.stop),paused:Boolean(result.paused),jobId:job.id,
      counts:result.counts||await core.counts(),
      saved:(result.saved||[]).map(x=>x.index),
      lastError:result.lastError||null
    });
  }catch(error){
    console.error('cron-preanalysis-a7f3c9',error&&error.message,error&&error.detail||'');
    return res.status(500).json({error:String(error&&error.message||'CRON_BATCH_FAILED')});
  }
};
