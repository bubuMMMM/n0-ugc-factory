const {waitUntil}=require('@vercel/functions');
const core=require('./_preanalysis-core');

async function work(jobId,host){
  const result=await core.runBatch(jobId);
  console.log('preanalysis batch',jobId,result.counts||{},result.saved||[],result.lastError||'');
  if(!result.stop){
    const url='https://'+host+'/api/admin/continue-preanalysis?job='+encodeURIComponent(jobId)+'&nonce='+Date.now();
    const r=await fetch(url,{headers:{'User-Agent':'videoma-preanalysis-chain/1.0'},signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('CONTINUATION_'+r.status);
  }
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const jobId=String(req.query&&req.query.job||'');
  if(!/^[0-9a-f-]{36}$/i.test(jobId))return res.status(400).json({error:'INVALID_JOB'});
  const job=await core.getJob(jobId).catch(()=>null);
  if(!job)return res.status(404).json({error:'JOB_NOT_FOUND'});
  if(!job.active)return res.status(200).json({started:false,done:true,job});
  const host=String(req.headers.host||process.env.VERCEL_PROJECT_PRODUCTION_URL||'n0-ugc-factory.vercel.app');
  waitUntil(work(jobId,host));
  return res.status(202).json({started:true,jobId,ready:job.ready,pending:job.pending,errors:job.errors,processing:job.processing});
};