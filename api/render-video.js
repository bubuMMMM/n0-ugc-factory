const fs=require('node:fs');
const crypto=require('node:crypto');
const {put}=require('@vercel/blob');
const db=require('./_db');
const {requireProject,limitProject}=require('./_project-auth');
const {renderVideo,safeRect}=require('./_renderer');
const {LAYOUT_VERSION,RENDER_VERSION}=require('./_versions');

function hash(value){return crypto.createHash('sha256').update(String(value||'')).digest('hex')}
function blobOptions(){
  const options={
    access:'private',
    addRandomSuffix:false,
    allowOverwrite:true,
    contentType:'video/mp4'
  };
  if(process.env.BLOB_READ_WRITE_TOKEN)options.token=process.env.BLOB_READ_WRITE_TOKEN;
  else if(process.env.VERCEL_OIDC_TOKEN)options.oidcToken=process.env.VERCEL_OIDC_TOKEN;
  return options;
}
function blobConfigured(){
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN||process.env.VERCEL_OIDC_TOKEN);
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET')return res.status(200).json({configured:blobConfigured(),renderVersion:RENDER_VERSION});
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!blobConfigured())return res.status(503).json({error:'BLOB_NOT_CONFIGURED'});

  let project;
  try{project=await requireProject(req)}catch{return res.status(401).json({error:'PROJECT_UNAUTHORIZED'})}
  const quota=await limitProject(project,'render',40,3600).catch(()=>({allowed:true}));
  if(!quota.allowed)return res.status(429).json({error:'PROJECT_RENDER_RATE_LIMIT'});

  const index=Number(req.body&&req.body.index);
  if(!Number.isInteger(index)||index<1||index>5000)return res.status(400).json({error:'INVALID_VIDEO_INDEX'});

  let renderId=null,output=null;
  try{
    const q=await db.query(
      "select h.id hook_assignment_id,h.hook,h.second_line,h.hook_style,h.max_lines,h.safe_for_auto_approval,"+
      "h.accepted,h.text_rect,h.font_scale,h.horizontal_align,h.layout_version,h.face_occlusion_penalty,h.layout_score,"+
      "v.id video_id,v.canonical_index,v.source_url "+
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

    const hookHash=hash(JSON.stringify({
      hook:row.hook,
      secondLine:row.second_line||'',
      style:row.hook_style||'short',
      maxLines:Number(row.max_lines)||2,
      textRect:rect,
      fontScale:Number(row.font_scale)||1,
      horizontalAlign:row.horizontal_align||'center',
      layoutVersion:row.layout_version,
      renderVersion:RENDER_VERSION
    }));

    const existing=await db.query(
      "select id,status,updated_at from video_renders where generation_project_id=$1 and video_id=$2 and hook_hash=$3 limit 1",
      [project.id,row.video_id,hookHash]
    );
    if(existing.rows[0]&&existing.rows[0].status==='ready'){
      return res.status(200).json({renderId:existing.rows[0].id,status:'ready',cached:true,index});
    }
    if(existing.rows[0]&&existing.rows[0].status==='processing'&&Date.now()-new Date(existing.rows[0].updated_at).getTime()<8*60*1000){
      return res.status(202).json({renderId:existing.rows[0].id,status:'processing',cached:true,index});
    }

    const upsert=await db.query(
      "insert into video_renders(generation_project_id,brand_profile_id,video_id,hook_assignment_id,hook_hash,render_version,status,layout_version,font_scale,text_rect,horizontal_align) "+
      "values($1,$2,$3,$4,$5,$6,'processing',$7,$8,$9::jsonb,$10) "+
      "on conflict(generation_project_id,video_id,hook_hash) do update set status='processing',error_message=null,updated_at=now(),hook_assignment_id=excluded.hook_assignment_id,layout_version=excluded.layout_version,font_scale=excluded.font_scale,text_rect=excluded.text_rect,horizontal_align=excluded.horizontal_align "+
      "returning id",
      [project.id,project.brand_profile_id,row.video_id,row.hook_assignment_id,hookHash,RENDER_VERSION,row.layout_version,Number(row.font_scale)||1,JSON.stringify(rect),row.horizontal_align||'center']
    );
    renderId=upsert.rows[0].id;

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

    const pathname='videoma-renders/'+project.id+'/'+String(index).padStart(4,'0')+'-'+hookHash.slice(0,16)+'.mp4';
    const blob=await put(pathname,fs.createReadStream(output),blobOptions());

    await db.query(
      "update video_renders set status='ready',blob_url=$2,blob_pathname=$3,size_bytes=$4,duration_ms=$5,width=$6,height=$7,error_message=null,completed_at=now(),updated_at=now() where id=$1",
      [renderId,blob.url,blob.pathname||pathname,rendered.size,rendered.durationMs,rendered.width,rendered.height]
    );

    return res.status(200).json({
      renderId,status:'ready',cached:false,index,
      sizeBytes:rendered.size,durationMs:rendered.durationMs
    });
  }catch(error){
    console.error('render-video',error&&error.message,error&&error.detail||'');
    if(renderId){
      await db.query(
        "update video_renders set status='error',error_message=$2,updated_at=now() where id=$1",
        [renderId,String(error&&error.message||'RENDER_FAILED').slice(0,500)]
      ).catch(()=>{});
    }
    return res.status(500).json({error:String(error&&error.message||'RENDER_FAILED')});
  }finally{
    if(output){try{fs.unlinkSync(output)}catch{}}
  }
};
