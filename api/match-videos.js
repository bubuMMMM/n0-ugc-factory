const db=require('./_db');
const {embedMany,EMBEDDING_MODEL}=require('./_embedding');

function t(x,n=500){return String(x||'').replace(/\s+/g,' ').trim().slice(0,n)}
function domainOf(raw){try{return new URL(raw).hostname.toLowerCase()}catch{return t(raw,255)}}
function push(out,type,value,extra){
  extra=extra||{};const valueText=t(value,700);if(!valueText)return;
  out.push({type,text:valueText,weight:Number(extra.weight)||1,sourceUrl:t(extra.sourceUrl,1000),evidence:t(extra.evidence,1000)});
}
function signalsFromProfile(p){
  const out=[];
  for(const x of p.pains||[])push(out,'pain',x,{weight:1.18});
  for(const x of p.desires||[])push(out,'desire',x,{weight:1.08});
  for(const x of p.benefits||[])push(out,'benefit',x,{weight:1.12});
  for(const x of p.objections||[])push(out,'objection',x,{weight:1.2});
  for(const x of p.jobsToBeDone||[])push(out,'job',x,{weight:1.05});
  for(const x of p.differentiators||[])push(out,'differentiator',x,{weight:1.12});
  for(const x of p.customerLanguage||[])push(out,'customer_language',x,{weight:1.12});
  for(const x of p.proofPoints||[])push(out,'proof',x.claim||x.evidence,{weight:1.25,sourceUrl:x.sourceUrl,evidence:x.evidence});
  for(const x of p.faqInsights||[])push(out,'faq',(x.question||'')+' '+(x.answer||''),{weight:1.06,evidence:x.hookPotential});
  for(const x of p.contentPillars||[])push(out,'angle',(x.name||'')+': '+(x.insight||''),{weight:1.1,evidence:x.evidence});
  for(const x of p.hookPlaybook||[])push(out,'angle',(x.angle||'')+': '+(x.insight||''),{weight:1.08,evidence:x.examplePattern});
  const seen=new Set();
  return out.filter(x=>{const k=x.type+'|'+x.text.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,48);
}
function reactionScore(type,reaction,compat){
  reaction=String(reaction||'').toLowerCase();compat=(compat||[]).map(x=>String(x).toLowerCase());
  const map={
    pain:['frustration','confusion','sceptic','embarras'],
    objection:['sceptic','confusion','frustration','réflexion','reflection'],
    desire:['validation','soulagement','surprise','rire','joie'],
    benefit:['validation','soulagement','surprise','joie'],
    proof:['demonstration','démonstration','validation','pointage','sceptic'],
    differentiator:['surprise','pointage','demonstration','découverte','decouverte'],
    faq:['confusion','sceptic','réflexion','reflection','calme'],
    job:['calme','réflexion','reflection','pointage','demonstration'],
    customer_language:['confusion','rire','sceptic','calme','frustration'],
    angle:['surprise','frustration','validation','sceptic','pointage','découverte','decouverte','calme']
  };
  const wanted=map[type]||[];
  if(wanted.some(x=>reaction.includes(x)))return .96;
  const compatByType={
    pain:['pain','diagnostic','confession','mistake','objection'],
    objection:['objection','diagnostic','overheard','take'],
    desire:['benefit','transformation','story','value'],
    proof:['proof','demonstration','credential','product_natural'],
    differentiator:['insider','pattern_break','product_natural','discovery'],
    faq:['overheard','diagnostic','value','numbered'],
    customer_language:['overheard','pov','fourthwall'],
    job:['pov','story','value'],
    angle:[]
  };
  if((compatByType[type]||[]).some(x=>compat.includes(x)))return .86;
  return .58;
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'){
    if(!db.configured())return res.status(200).json({configured:false,ready:0,database:db.parseDatabaseUrl()});
    const r=await db.query("select count(*)::int ready from video_intelligence where status='ready' and embedding is not null");
    return res.status(200).json({configured:true,ready:r.rows[0]&&r.rows[0].ready||0,embeddingModel:EMBEDDING_MODEL});
  }
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!db.configured())return res.status(503).json({error:'DATABASE_NOT_CONFIGURED'});
  const profile=req.body&&req.body.profile,website=t(req.body&&req.body.website,1500);
  const requestedProfileId=t(req.body&&req.body.brandProfileId,80);
  if(!profile||typeof profile!=='object')return res.status(400).json({error:'PROFILE_REQUIRED'});
  try{
    const signals=signalsFromProfile(profile);
    if(!signals.length)return res.status(422).json({error:'NO_BRAND_SIGNALS'});
    const embeddings=await embedMany(signals.map(x=>x.text));
    const profileText=[profile.brand,profile.category,profile.summary,profile.primaryOffer]
      .concat(profile.pains||[],profile.desires||[],profile.objections||[],profile.differentiators||[])
      .filter(Boolean).join('\n');
    const profileEmbedding=(await embedMany([profileText]))[0];
    let profileId=null;
    if(/^[0-9a-f-]{36}$/i.test(requestedProfileId)){
      const requestedDomain=domainOf(website);
      const existing=await db.query("select id from brand_profiles where id=$1 and domain=$2",[requestedProfileId,requestedDomain]);
      if(existing.rows[0]){
        profileId=existing.rows[0].id;
        await db.query(
          "update brand_profiles set website=$2,domain=$3,profile=$4::jsonb,embedding_model=$5,embedding=$6::vector,analysis_version='brand-intel-v3' where id=$1",
          [profileId,website,domainOf(website),JSON.stringify(profile),EMBEDDING_MODEL,db.vectorLiteral(profileEmbedding)]
        );
        await db.query("delete from brand_signals where brand_profile_id=$1",[profileId]);
      }
    }
    if(!profileId){
      const pr=await db.query(
        "insert into brand_profiles(website,domain,analysis_version,profile,embedding_model,embedding) values($1,$2,'brand-intel-v3',$3::jsonb,$4,$5::vector) returning id",
        [website,domainOf(website),JSON.stringify(profile),EMBEDDING_MODEL,db.vectorLiteral(profileEmbedding)]
      );
      profileId=pr.rows[0].id;
    }
    for(let i=0;i<signals.length;i++){
      const x=signals[i];
      const r=await db.query(
        "insert into brand_signals(brand_profile_id,signal_type,text,source_url,evidence,weight,embedding) values($1,$2,$3,$4,$5,$6,$7::vector) returning id",
        [profileId,x.type,x.text,x.sourceUrl||null,x.evidence||null,x.weight,db.vectorLiteral(embeddings[i])]
      );
      x.id=r.rows[0].id;
    }

    const sql=[
      "with candidates as (",
      "select v.id video_id,v.canonical_index,v.source_url,v.duration_ms,v.scene,v.action,v.primary_emotion,v.emotions,",
      "v.objects,v.gestures,v.person_count,v.has_phone,v.has_computer,v.has_product,v.gaze_direction,",
      "v.reaction_intensity,v.energy_score,v.versatility_score,v.reaction_type,v.visual_focus,v.peak_moment_ms,",
      "v.peak_reason,v.text_safe_zone,v.face_regions,v.object_regions,v.hook_compatibility,v.tags,v.transcript,",
      "s.id signal_id,s.signal_type,s.text signal_text,s.evidence signal_evidence,s.source_url signal_source,s.weight,",
      "greatest(0,least(1,1-(v.embedding <=> s.embedding))) semantic_similarity,",
      "row_number() over(partition by v.id order by (v.embedding <=> s.embedding) asc) rn",
      "from video_intelligence v cross join brand_signals s",
      "where v.status='ready' and v.embedding is not null and s.brand_profile_id=$1",
      ") select * from candidates where rn<=5 order by canonical_index,rn"
    ].join(' ');
    const ranked=await db.query(sql,[profileId]);
    const grouped=new Map();
    for(const row of ranked.rows){
      if(!grouped.has(row.video_id))grouped.set(row.video_id,[]);
      grouped.get(row.video_id).push(row);
    }
    const matches=[];
    for(const rows of grouped.values()){
      let best=null;
      for(const row of rows){
        const reaction=reactionScore(row.signal_type,row.reaction_type,row.hook_compatibility);
        const semantic=Number(row.semantic_similarity)||0;
        const versatility=(Number(row.versatility_score)||0)/100;
        const energy=(Number(row.energy_score)||0)/100;
        const weighted=Math.max(0,Math.min(1,(semantic*.66)+(reaction*.19)+(versatility*.10)+(energy*.05)))*(Number(row.weight)||1);
        if(!best||weighted>best.score)best={row,reaction,score:weighted};
      }
      if(!best)continue;
      const r=best.row,compat=Math.round(Math.min(100,best.score*100));
      const reasons=['semantic '+Math.round(Number(r.semantic_similarity)*100),'reaction '+Math.round(best.reaction*100),'versatility '+(Number(r.versatility_score)||0)];
      await db.query(
        "insert into video_brand_matches(brand_profile_id,video_id,brand_signal_id,semantic_similarity,emotion_match,reaction_match,versatility,compatibility_score,reasons) "+
        "values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) "+
        "on conflict(brand_profile_id,video_id) do update set brand_signal_id=excluded.brand_signal_id,semantic_similarity=excluded.semantic_similarity,"+
        "emotion_match=excluded.emotion_match,reaction_match=excluded.reaction_match,versatility=excluded.versatility,compatibility_score=excluded.compatibility_score,reasons=excluded.reasons",
        [profileId,r.video_id,r.signal_id,Number(r.semantic_similarity),best.reaction,best.reaction,(Number(r.versatility_score)||0)/100,compat,JSON.stringify(reasons)]
      );
      matches.push({
        index:r.canonical_index,url:r.source_url,compatibilityScore:compat,
        signal:{id:r.signal_id,type:r.signal_type,text:r.signal_text,evidence:r.signal_evidence||'',sourceUrl:r.signal_source||''},
        intelligence:{
          id:r.video_id,durationMs:r.duration_ms,scene:r.scene,action:r.action,primaryEmotion:r.primary_emotion,emotions:r.emotions||[],
          objects:r.objects||[],gestures:r.gestures||[],personCount:r.person_count,hasPhone:r.has_phone,hasComputer:r.has_computer,
          hasProduct:r.has_product,gazeDirection:r.gaze_direction,reactionIntensity:r.reaction_intensity,energyScore:r.energy_score,
          versatilityScore:r.versatility_score,reactionType:r.reaction_type,visualFocus:r.visual_focus,peakMomentMs:r.peak_moment_ms,
          peakReason:r.peak_reason,textSafeZone:r.text_safe_zone,faceRegions:r.face_regions,objectRegions:r.object_regions,
          hookCompatibility:r.hook_compatibility||[],tags:r.tags||[],transcript:r.transcript||''
        }
      });
    }
    return res.status(200).json({brandProfileId:profileId,matches,signals:signals.map(x=>({id:x.id,type:x.type,text:x.text})),embeddingModel:EMBEDDING_MODEL});
  }catch(err){
    console.error('match videos',err&&err.message,err&&err.detail||'');
    const code=String(err&&err.message||'MATCH_FAILED');
    const status=
      code==='AI_GATEWAY_INSUFFICIENT_FUNDS'?402:
      code==='AI_GATEWAY_RATE_LIMIT'?429:
      code==='AI_GATEWAY_TIMEOUT'||code==='EMBEDDING_TIMEOUT'||code==='JEV_TIMEOUT'?504:
      code==='AI_GATEWAY_NOT_CONFIGURED'||code==='AI_GATEWAY_UNAVAILABLE'?503:
      code==='AI_GATEWAY_AUTH_ERROR'?502:500;
    return res.status(status).json({error:code});
  }
};