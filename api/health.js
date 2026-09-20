const {credential,canDirect,MODEL,DIRECT_MODEL}=require('./_ai');
const {JEV_MODEL}=require('./_jev');
const db=require('./_db');
const {isAdmin}=require('./admin/_auth');
const {VIDEO_INTELLIGENCE_VERSION,LAYOUT_VERSION,RENDER_VERSION}=require('./_versions');
const {hasUsableGeometry}=require('./_layout');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const result={
    ok:true,
    aiGatewayConfigured:Boolean(credential()),
    directOpenAIConfigured:Boolean(canDirect()),
    aiConfigured:Boolean(credential()||canDirect()),
    generatorModel:MODEL,
    directOpenAIModel:DIRECT_MODEL,
    evaluatorModel:JEV_MODEL,
    databaseConfigured:db.configured(),
    stripeConfigured:Boolean(process.env.STRIPE_SECRET_KEY),
    blobConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN||process.env.VERCEL_OIDC_TOKEN),
    layoutVersion:LAYOUT_VERSION,
    renderVersion:RENDER_VERSION,
    videoIntelligence:{ready:0,pending:0,processing:0,errors:0,total:0,currentVersionReady:0,geometryReady:0}
  };
  if(db.configured()){
    try{
      const r=await db.query(
        "select count(*)::int total,"+
        "count(*) filter(where status='ready')::int ready,"+
        "count(*) filter(where status='pending')::int pending,"+
        "count(*) filter(where status='processing')::int processing,"+
        "count(*) filter(where status='error')::int errors from video_intelligence"
      );
      result.videoIntelligence=r.rows[0]||result.videoIntelligence;
      const current=await db.query(
        "select count(*)::int ready from video_intelligence where status='ready' and analysis_version=$1",
        [VIDEO_INTELLIGENCE_VERSION]
      );
      result.videoIntelligence.currentVersionReady=current.rows[0]?.ready||0;
      const geometryRows=await db.query(
        "select text_safe_zone,face_regions,object_regions from video_intelligence where status='ready' and analysis_version=$1",
        [VIDEO_INTELLIGENCE_VERSION]
      );
      result.videoIntelligence.geometryReady=geometryRows.rows.filter(row=>hasUsableGeometry({
        textSafeZone:row.text_safe_zone||{},
        faceRegions:row.face_regions||[],
        objectRegions:row.object_regions||[]
      })).length;
      const j=await db.query("select id,active,last_error,updated_at from preanalysis_jobs order by started_at desc limit 1").catch(()=>({rows:[]}));
      const job=j.rows[0]||null;
      result.functional={
        ai:Boolean(credential()||canDirect()),
        database:true,
        preanalysisBlocked:Boolean(job&&!job.active&&/INSUFFICIENT_FUNDS|AUTH_ERROR|NOT_CONFIGURED/.test(String(job.last_error||'')))
      };
      result.preanalysis={
        active:Boolean(job&&job.active),
        blocked:Boolean(job&&!job.active&&job.last_error),
        lastErrorCode:job&&job.last_error?String(job.last_error):null,
        updatedAt:job&&job.updated_at||null
      };
      if(isAdmin(req)){
        result.preanalysisJob=job;
        const renders=await db.query(
          "select count(*)::int total,count(*) filter(where status='ready')::int ready,count(*) filter(where status='processing')::int processing,count(*) filter(where status='error')::int errors from video_renders"
        ).catch(()=>({rows:[{total:0,ready:0,processing:0,errors:0}]}));
        result.renders=renders.rows[0];
      }
    }catch(error){
      result.ok=false;
      result.databaseError=String(error&&error.message||'DATABASE_ERROR');
    }
  }
  return res.status(result.ok?200:503).json(result);
};
