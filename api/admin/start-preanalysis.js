const crypto=require('node:crypto');
const {waitUntil}=require('@vercel/functions');
const db=require('../_db');
const core=require('./_preanalysis-core');

const TOKEN_HASH='9996e925d80a5c88d8754d6363747a4811e06827d02ffcf227e8e7247b256214';

function authorized(req){
  const token=String(req.query&&req.query.token||req.headers['x-preanalysis-token']||'');
  if(!token)return false;
  return crypto.createHash('sha256').update(token).digest('hex')===TOKEN_HASH;
}
async function kick(jobId,host){
  const url='https://'+host+'/api/admin/continue-preanalysis?job='+encodeURIComponent(jobId)+'&nonce='+Date.now();
  const r=await fetch(url,{headers:{'User-Agent':'videoma-preanalysis-start/1.0'},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('CONTINUATION_START_'+r.status);
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
    const host=String(req.headers.host||process.env.VERCEL_PROJECT_PRODUCTION_URL||'n0-ugc-factory.vercel.app');
    waitUntil(kick(jobId,host));
    const c=await core.counts();
    return res.status(202).json({
      started:true,jobId,...c,batch:core.BATCH,model:core.MODEL,embeddingModel:core.EMBEDDING_MODEL
    });
  }catch(error){
    console.error('start-preanalysis',error&&error.message,error&&error.detail||'');
    return res.status(500).json({error:String(error&&error.message||'START_FAILED')});
  }
};