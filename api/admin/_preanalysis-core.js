// Permanent catalogue review is offline. This module cannot call model APIs.
const db=require('../_db');
const {VIDEO_INTELLIGENCE_VERSION:VERSION}=require('../_versions');
const MODEL=null, EMBEDDING_MODEL=null, BATCH=0;
async function counts(){
  const q=await db.query(
    "select count(*)::int total,"+
    "count(*) filter(where status='ready')::int ready,"+
    "count(*) filter(where status='pending')::int pending,"+
    "count(*) filter(where status='error')::int errors,"+
    "count(*) filter(where status='processing')::int processing,"+
    "count(*) filter(where status='ready' and coalesce(analysis_version,'')<>$1)::int outdated "+
    "from video_intelligence",
    [VERSION]
  );
  return q.rows[0];
}

async function getJob(id){
  const r=await db.query('select * from preanalysis_jobs where id=$1',[id]);
  return r.rows[0]||null;
}
async function ensureActiveJob(){return null}
async function runBatch(){
  return {stop:true,paused:true,reason:'OFFLINE_PREANALYSIS_ONLY',saved:[]};
}
module.exports={VERSION,MODEL,EMBEDDING_MODEL,BATCH,counts,getJob,ensureActiveJob,runBatch};
