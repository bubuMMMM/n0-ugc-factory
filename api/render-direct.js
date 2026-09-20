const fs=require('node:fs');
const db=require('./_db');
const {requireProject,limitProject}=require('./_project-auth');
const {renderVideo,safeRect}=require('./_renderer');
const {LAYOUT_VERSION}=require('./_versions');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  let project;
  try{project=await requireProject(req)}catch{return res.status(401).json({error:'PROJECT_UNAUTHORIZED'})}
  const quota=await limitProject(project,'render-direct',20,3600).catch(()=>({allowed:true}));
  if(!quota.allowed)return res.status(429).json({error:'PROJECT_RENDER_RATE_LIMIT'});

  const index=Number(req.body&&req.body.index);
  if(!Number.isInteger(index)||index<1||index>5000)return res.status(400).json({error:'INVALID_VIDEO_INDEX'});

  let output=null;
  try{
    const q=await db.query(
      "select h.hook,h.second_line,h.hook_style,h.max_lines,h.safe_for_auto_approval,h.accepted,h.text_rect,h.font_scale,h.horizontal_align,h.layout_version,h.face_occlusion_penalty,h.layout_score,v.source_url,v.canonical_index "+
      "from hook_assignments h join video_intelligence v on v.id=h.video_id "+
      "where h.brand_profile_id=$1 and v.canonical_index=$2 limit 1",
      [project.brand_profile_id,index]
    );
    const row=q.rows[0];
    if(!row)return res.status(404).json({error:'ACCEPTED_HOOK_NOT_FOUND'});
    if(!row.accepted||!row.safe_for_auto_approval)return res.status(409).json({error:'HOOK_NOT_APPROVED_FOR_RENDER'});
    if(String(row.layout_version||'')!==LAYOUT_VERSION)return res.status(409).json({error:'LAYOUT_VERSION_STALE'});
    if(Number(row.face_occlusion_penalty)>8||Number(row.layout_score)<60)return res.status(409).json({error:'LAYOUT_NOT_FACE_SAFE'});
    const rect=safeRect(row.text_rect);
    if(!rect)return res.status(409).json({error:'RENDER_LAYOUT_INVALID'});

    const rendered=await renderVideo({
      sourceUrl:row.source_url,
      hook:row.hook,
      secondLine:row.second_line||'',
      textRect:rect,
      fontScale:Number(row.font_scale)||1,
      style:row.hook_style==='wall'?'wall':'short',
      horizontalAlign:row.horizontal_align||'center',
      maxLines:Math.max(1,Math.min(3,Number(row.max_lines)||2))
    });
    output=rendered.output;

    res.statusCode=200;
    res.setHeader('Content-Type','video/mp4');
    res.setHeader('Content-Length',String(rendered.size));
    res.setHeader('Content-Disposition','attachment; filename="videoma-'+String(row.canonical_index).padStart(4,'0')+'.mp4"');
    res.setHeader('X-Content-Type-Options','nosniff');

    const cleanup=()=>{if(output){try{fs.unlinkSync(output)}catch{}output=null}};
    res.once('finish',cleanup);res.once('close',cleanup);
    const stream=fs.createReadStream(output);
    stream.on('error',error=>{cleanup();if(!res.headersSent)res.status(500).end();else res.destroy(error)});
    stream.pipe(res);
  }catch(error){
    if(output){try{fs.unlinkSync(output)}catch{}}
    console.error('render-direct',error&&error.message,error&&error.detail||'');
    if(!res.headersSent)return res.status(500).json({error:String(error&&error.message||'RENDER_FAILED')});
    res.destroy(error);
  }
};
