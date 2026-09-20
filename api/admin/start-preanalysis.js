const db=require('../_db');
const core=require('./_preanalysis-core');
const {isAdmin,adminConfigured}=require('./_auth');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  }
  if(!adminConfigured())return res.status(503).json({error:'ADMIN_AUTH_NOT_CONFIGURED'});
  if(!isAdmin(req))return res.status(401).json({error:'UNAUTHORIZED'});
  if(!db.configured())return res.status(503).json({error:'DATABASE_NOT_CONFIGURED'});
  try{
    await core.seed();
    await core.recoverStale();
    await core.resetErrors();
    const jobId=await core.createJob();
    const c=await core.counts();
    return res.status(202).json({
      started:true,jobId,...c,batch:core.BATCH,model:core.MODEL,embeddingModel:core.EMBEDDING_MODEL,orchestration:'vercel-cron'
    });
  }catch(error){
    console.error('start-preanalysis',error&&error.message,error&&error.detail||'');
    return res.status(500).json({error:String(error&&error.message||'START_FAILED')});
  }
};