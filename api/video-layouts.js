const db=require('./_db');
const {VIDEO_INTELLIGENCE_VERSION,LAYOUT_VERSION}=require('./_versions');
const {resolveLayout,hasUsableGeometry}=require('./_layout');

function usableLegacyFaces(regions){
  if(!Array.isArray(regions)||!regions.length)return false;
  let valid=0;
  for(const face of regions){
    if(!face||typeof face!=='object'||Array.isArray(face))continue;
    const nums=[face.x,face.y,face.w,face.h].map(Number);
    if(!nums.every(Number.isFinite))continue;
    const [x,y,w,h]=nums;
    if(x<0||y<0||w<=0||h<=0||x+w>1.01||y+h>1.01)continue;
    valid++;
  }
  return valid>0;
}
function normalizeSafeZone(raw,current){
  const safe=raw&&typeof raw==='object'?{...raw}:{};
  if(!['top','upper','lower','bottom'].includes(String(safe.preferred||'')))safe.preferred='bottom';
  if(!['left','center','right'].includes(String(safe.horizontal||'')))safe.horizontal='center';
  if(!safe.zoneScores||typeof safe.zoneScores!=='object'){
    safe.zoneScores={top:78,upper:58,middle:16,lower:86,bottom:82};
  }
  if(!current){
    safe.allowSecondLine=false;
    safe.maxLines=1;
  }
  return safe;
}

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
      const rawIntelligence={
        textSafeZone:x.text_safe_zone||{},
        faceRegions:x.face_regions||[],
        objectRegions:x.object_regions||[],
        visualFocus:x.visual_focus||'',
        reactionType:x.reaction_type||'',
        energyScore:Number(x.energy_score)||0
      };
      const current=x.analysis_version===VIDEO_INTELLIGENCE_VERSION&&hasUsableGeometry(rawIntelligence);
      const legacy=!current&&usableLegacyFaces(rawIntelligence.faceRegions);
      if(!current&&!legacy)return null;
      if(current)currentVersionReady++;
      const intelligence={
        ...rawIntelligence,
        textSafeZone:normalizeSafeZone(rawIntelligence.textSafeZone,current)
      };
      const preferred=intelligence.textSafeZone.preferred||'bottom';
      const resolved=resolveLayout(intelligence,{
        requested:preferred,
        secondLine:current?'1':'',
        style:'short'
      });
      return {
        index:x.canonical_index,
        analysisVersion:x.analysis_version,
        current,
        legacy,
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
      legacyReady:layouts.filter(x=>x.legacy).length,
      layouts
    });
  }catch(error){
    console.error('video-layouts',error&&error.message);
    return res.status(500).json({error:'VIDEO_LAYOUTS_FAILED'});
  }
};