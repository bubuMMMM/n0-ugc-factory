const db=require('./_db');
const {VIDEO_INTELLIGENCE_VERSION}=require('./_versions');

module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=1800');
  if(!db.configured())return res.status(200).json({configured:false,ready:0,layouts:[]});
  try{
    const r=await db.query(
      "select canonical_index,analysis_version,text_safe_zone,face_regions,object_regions,visual_focus,reaction_type,energy_score "+
      "from video_intelligence where status='ready' and analysis_version=$1 order by canonical_index",
      [VIDEO_INTELLIGENCE_VERSION]
    );
    return res.status(200).json({
      configured:true,
      ready:r.rows.length,
      layouts:r.rows.map(x=>({
        index:x.canonical_index,
        analysisVersion:x.analysis_version,
        textSafeZone:x.text_safe_zone||{},
        faceRegions:x.face_regions||[],
        objectRegions:x.object_regions||[],
        visualFocus:x.visual_focus||'',
        reactionType:x.reaction_type||'',
        energyScore:Number(x.energy_score)||0
      }))
    });
  }catch(error){
    console.error('video-layouts',error&&error.message);
    return res.status(500).json({error:'VIDEO_LAYOUTS_FAILED'});
  }
};