const {Readable}=require('node:stream');
const {get}=require('@vercel/blob');
const db=require('./_db');
const {requireProject}=require('./_project-auth');

function blobOptions(){
  const options={access:'private'};
  if(process.env.BLOB_READ_WRITE_TOKEN)options.token=process.env.BLOB_READ_WRITE_TOKEN;
  else if(process.env.VERCEL_OIDC_TOKEN)options.oidcToken=process.env.VERCEL_OIDC_TOKEN;
  return options;
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  let project;
  try{project=await requireProject(req)}catch{return res.status(401).json({error:'PROJECT_UNAUTHORIZED'})}
  const id=String(req.query&&req.query.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'INVALID_RENDER_ID'});

  try{
    const q=await db.query(
      "select r.blob_pathname,v.canonical_index from video_renders r join video_intelligence v on v.id=r.video_id "+
      "where r.id=$1 and r.generation_project_id=$2 and r.status='ready' limit 1",
      [id,project.id]
    );
    const row=q.rows[0];
    if(!row||!row.blob_pathname)return res.status(404).json({error:'RENDER_NOT_FOUND'});
    const result=await get(row.blob_pathname,blobOptions());
    if(!result||result.statusCode!==200)return res.status(404).json({error:'RENDER_BLOB_NOT_FOUND'});
    res.setHeader('Content-Type',result.blob.contentType||'video/mp4');
    res.setHeader('Content-Disposition','attachment; filename="videoma-'+String(row.canonical_index).padStart(4,'0')+'.mp4"');
    res.setHeader('X-Content-Type-Options','nosniff');
    Readable.fromWeb(result.stream).pipe(res);
  }catch(error){
    console.error('render-download',error&&error.message);
    if(!res.headersSent)return res.status(500).json({error:'RENDER_DOWNLOAD_FAILED'});
    res.destroy(error);
  }
};
