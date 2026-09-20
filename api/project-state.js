const db=require('./_db');
const {requireProject,limitProject}=require('./_project-auth');
const {VIDEO_INTELLIGENCE_VERSION}=require('./_versions');
const {hasUsableGeometry}=require('./_layout');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  let project;
  try{project=await requireProject(req)}catch{return res.status(401).json({error:'PROJECT_UNAUTHORIZED'})}
  const quota=await limitProject(project,'state',120,3600).catch(()=>({allowed:true}));
  if(!quota.allowed)return res.status(429).json({error:'PROJECT_RATE_LIMIT'});

  try{
    const hooksResult=await db.query(
      "select v.canonical_index,h.hook,h.second_line,h.mechanism,h.visual_anchor,h.brand_anchor,h.placement,h.quality_score,h.accepted,h.rationale,"+
      "h.jev_accept_probability,h.evaluator_model,h.face_occlusion_penalty,h.layout_score,h.second_line_suppressed,h.layout_version,h.horizontal_align,h.text_rect,h.font_scale,h.hook_style,h.max_lines,h.safe_for_auto_approval "+
      "from hook_assignments h join video_intelligence v on v.id=h.video_id "+
      "where h.brand_profile_id=$1 order by v.canonical_index",
      [project.brand_profile_id]
    );

    const matchResult=await db.query(
      "select v.id video_id,v.canonical_index,v.duration_ms,v.scene,v.action,v.primary_emotion,v.emotions,v.objects,v.gestures,v.person_count,v.has_phone,v.has_computer,v.has_product,v.gaze_direction,v.reaction_intensity,v.energy_score,v.versatility_score,v.reaction_type,v.visual_focus,v.peak_moment_ms,v.peak_reason,v.text_safe_zone,v.face_regions,v.object_regions,v.hook_compatibility,v.tags,v.analysis_version,"+
      "m.compatibility_score,s.id signal_id,s.signal_type,s.text signal_text,s.evidence signal_evidence,s.source_url signal_source "+
      "from video_brand_matches m join video_intelligence v on v.id=m.video_id left join brand_signals s on s.id=m.brand_signal_id "+
      "where m.brand_profile_id=$1 and v.status='ready' and v.analysis_version=$2 order by v.canonical_index",
      [project.brand_profile_id,VIDEO_INTELLIGENCE_VERSION]
    );

    const hooks=hooksResult.rows.map(r=>({
      index:Number(r.canonical_index),
      hook:r.hook||'',
      meta:{
        secondLine:r.second_line||'',mechanism:r.mechanism||'',visualCue:r.visual_anchor||'',brandAnchor:r.brand_anchor||'',
        placement:r.placement||'lower',quality:Number(r.quality_score)||0,accepted:Boolean(r.accepted),rationale:r.rationale||'',
        jevAcceptProbability:Number(r.jev_accept_probability)||0,evaluator:r.evaluator_model||'',
        faceOcclusionPenalty:Number(r.face_occlusion_penalty)||0,layoutScore:Number(r.layout_score)||0,
        secondLineSuppressed:Boolean(r.second_line_suppressed),layoutVersion:r.layout_version||'',
        horizontalAlign:r.horizontal_align||'center',textRect:r.text_rect||null,fontScale:Number(r.font_scale)||1,
        style:r.hook_style||'short',maxLines:Number(r.max_lines)||2,safeForAutoApproval:Boolean(r.safe_for_auto_approval),
        grounded:true,source:'video-intelligence'
      }
    }));

    const matches=[];
    for(const r of matchResult.rows){
      const intelligence={
        id:r.video_id,durationMs:r.duration_ms,scene:r.scene,action:r.action,primaryEmotion:r.primary_emotion,
        emotions:r.emotions||[],objects:r.objects||[],gestures:r.gestures||[],personCount:r.person_count,
        hasPhone:r.has_phone,hasComputer:r.has_computer,hasProduct:r.has_product,gazeDirection:r.gaze_direction,
        reactionIntensity:r.reaction_intensity,energyScore:r.energy_score,versatilityScore:r.versatility_score,
        reactionType:r.reaction_type,visualFocus:r.visual_focus,peakMomentMs:r.peak_moment_ms,peakReason:r.peak_reason,
        textSafeZone:r.text_safe_zone||{},faceRegions:r.face_regions||[],objectRegions:r.object_regions||[],
        hookCompatibility:r.hook_compatibility||[],tags:r.tags||[]
      };
      if(!hasUsableGeometry(intelligence))continue;
      matches.push({
        index:Number(r.canonical_index),compatibilityScore:Number(r.compatibility_score)||0,
        signal:{id:r.signal_id||null,type:r.signal_type||'angle',text:r.signal_text||'',evidence:r.signal_evidence||'',sourceUrl:r.signal_source||''},
        intelligence
      });
    }

    const renderCounts=await db.query(
      "select count(*)::int total,count(*) filter(where status='ready')::int delivered,count(*) filter(where status='processing')::int rendering,count(*) filter(where status='error')::int render_errors from video_renders where generation_project_id=$1",
      [project.id]
    ).catch(()=>({rows:[{total:0,delivered:0,rendering:0,render_errors:0}]}));

    return res.status(200).json({
      project:{
        id:project.id,brandProfileId:project.brand_profile_id,website:project.website,expiresAt:project.expires_at
      },
      profile:project.profile,
      hooks,matches,
      progress:{
        generated:hooks.length,
        validated:hooks.filter(x=>x.meta.accepted).length,
        delivered:Number(renderCounts.rows[0]?.delivered)||0,
        rendering:Number(renderCounts.rows[0]?.rendering)||0,
        renderErrors:Number(renderCounts.rows[0]?.render_errors)||0
      }
    });
  }catch(error){
    console.error('project-state',error&&error.message);
    return res.status(500).json({error:'PROJECT_STATE_FAILED'});
  }
};
