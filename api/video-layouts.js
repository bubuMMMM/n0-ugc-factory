const db=require('./_db');
const {resolveLayout}=require('./_layout');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!db.configured())return res.status(200).json({configured:false,ready:0,items:[]});
  try{
    const r=await db.query(
      "select canonical_index,person_count,reaction_intensity,text_safe_zone,face_regions,object_regions,visual_focus "+
      "from video_intelligence where status='ready' order by canonical_index"
    );
    const items=r.rows.map(row=>{
      const intelligence={
        personCount:row.person_count,
        reactionIntensity:row.reaction_intensity,
        textSafeZone:row.text_safe_zone||{},
        faceRegions:row.face_regions||[],
        objectRegions:row.object_regions||[],
        visualFocus:row.visual_focus||''
      };
      return {
        index:row.canonical_index,
        ...resolveLayout(intelligence,{hook:'1000 vidéos en moins de 5 min.',secondLine:'',style:'short'}),
        textSafeZone:intelligence.textSafeZone,
        faceRegions:intelligence.faceRegions
      };
    });
    return res.status(200).json({configured:true,ready:items.length,items});
  }catch(error){
    console.error('video-layouts',error&&error.message);
    return res.status(500).json({error:'VIDEO_LAYOUTS_FAILED'});
  }
};