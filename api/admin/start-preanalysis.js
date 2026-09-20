const crypto=require('node:crypto');
const db=require('../_db');
const core=require('./_preanalysis-core');

const TOKEN_HASH='9996e925d80a5c88d8754d6363747a4811e06827d02ffcf227e8e7247b256214';

function authorized(req){
  const token=String(req.query&&req.query.token||req.headers['x-preanalysis-token']||'');
  if(!token)return false;
  return crypto.createHash('sha256').update(token).digest('hex')===TOKEN_HASH;
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!authorized(req))return res.status(401).json({error:'UNAUTHORIZED'});
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