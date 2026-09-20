const {credential,canDirect,MODEL,DIRECT_MODEL}=require('./_ai');
const {JEV_MODEL}=require('./_jev');
const db=require('./_db');

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
    videoIntelligence:{ready:0,pending:0,processing:0,errors:0,total:0}
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
      const j=await db.query("select id,active,last_error,updated_at from preanalysis_jobs order by started_at desc limit 1").catch(()=>({rows:[]}));
      result.preanalysisJob=j.rows[0]||null;
    }catch(error){
      result.ok=false;
      result.databaseError=String(error&&error.message||'DATABASE_ERROR');
    }
  }
  return res.status(result.ok?200:503).json(result);
};
