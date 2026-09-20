const db=require('./_db');
const {VIDEO_INTELLIGENCE_VERSION,LAYOUT_VERSION}=require('./_versions');
const {resolveLayout,hasUsableGeometry}=require('./_layout');

module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  res.setHeader('Cache-Control','public, s-maxage=90, stale-while-revalidate=600');
  if(!db.configured())return res.status(200).json({configured:false,ready:0,currentVersionReady:0,layouts:[]});
  try{
    const r=await db.query(
      "select canonical_index,analysis_version,text_safe_zone,face_regions,object_regions,visual_focus,reaction_type,energy_score "+
      "from video_intelligence where status='ready' order by canonical_index"
    );
    let currentVersionReady=0;
    const layouts=r.rows.map(x=>{
      const intelligence={
        textSafeZone:x.text_safe_zone||{},
        faceRegions:x.face_regions||[],
        objectRegions:x.object_regions||[],
        visualFocus:x.visual_focus||'',
        reactionType:x.reaction_type||'',
        energyScore:Number(x.energy_score)||0
      };
      const current=x.analysis_version===VIDEO_INTELLIGENCE_VERSION&&hasUsableGeometry(intelligence);
      if(!current)return null;
      currentVersionReady++;
      const preferred=intelligence.textSafeZone&&intelligence.textSafeZone.preferred||'bottom';
      const resolved=resolveLayout(intelligence,{requested:preferred,secondLine:'1',style:'short'});
      return {
        index:x.canonical_index,
        analysisVersion:x.analysis_version,
        current,
        layoutVersion:LAYOUT_VERSION,
        textSafeZone:intelligence.textSafeZone,
        faceRegions:intelligence.faceRegions,
        objectRegions:intelligence.objectRegions,
        visualFocus:intelligence.visualFocus,
        reactionType:intelligence.reactionType,
        energyScore:intelligence.energyScore,
        placement:resolved.placement,
        horizontalAlign:resolved.horizontalAlign,
        textRect:resolved.textRect,
        fontScale:resolved.fontScale,
        allowSecondLine:resolved.allowSecondLine,
        maxLines:resolved.maxLines,
        compact:resolved.compact,
        noSafeZone:resolved.noSafeZone,
        faceOcclusionPenalty:resolved.faceOcclusionPenalty,
        objectOcclusionPenalty:resolved.objectOcclusionPenalty,
        layoutScore:resolved.layoutScore,
        safeForAutoApproval:resolved.safeForAutoApproval
      };
    }).filter(Boolean);
    return res.status(200).json({
      configured:true,
      ready:layouts.length,
      currentVersionReady,
      layouts
    });
  }catch(error){
    console.error('video-layouts',error&&error.message);
    return res.status(500).json({error:'VIDEO_LAYOUTS_FAILED'});
  }
};