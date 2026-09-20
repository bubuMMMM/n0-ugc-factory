const db=require('./_db');
const {requireProject,limitProject}=require('./_project-auth');

function clean(value,max){
  return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='PATCH')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});

  let project;
  try{project=await requireProject(req)}catch{return res.status(401).json({error:'PROJECT_UNAUTHORIZED'})}
  const quota=await limitProject(project,'profile-edit',12,3600).catch(()=>({allowed:true}));
  if(!quota.allowed)return res.status(429).json({error:'PROJECT_RATE_LIMIT'});

  const brand=clean(req.body&&req.body.brand,80);
  const primaryOffer=clean(req.body&&req.body.primaryOffer,240);
  const summary=clean(req.body&&req.body.summary,600);
  if(!brand||!primaryOffer||summary.length<20)return res.status(400).json({error:'INVALID_PROFILE_EDIT'});

  const profile={...(project.profile||{}),brand,primaryOffer,summary};
  const client=await db.getPool().connect();
  try{
    await client.query('begin');
    await client.query(
      "update brand_profiles set profile=$2::jsonb,analysis_version='brand-intel-v4-user-edited',updated_at=now() where id=$1",
      [project.brand_profile_id,JSON.stringify(profile)]
    );
    await client.query("delete from video_brand_matches where brand_profile_id=$1",[project.brand_profile_id]);
    await client.query("delete from brand_signals where brand_profile_id=$1",[project.brand_profile_id]);
    await client.query(
      "update hook_assignments set accepted=false,rationale=case when rationale is null or rationale='' then 'Profil marque modifié — régénération requise' else rationale||' | Profil marque modifié — régénération requise' end,updated_at=now() where brand_profile_id=$1",
      [project.brand_profile_id]
    );
    await client.query('commit');
    return res.status(200).json({profile,requiresRematch:true,requiresRegeneration:true});
  }catch(error){
    try{await client.query('rollback')}catch{}
    console.error('project-profile',error&&error.message);
    return res.status(500).json({error:'PROFILE_UPDATE_FAILED'});
  }finally{
    client.release();
  }
};
