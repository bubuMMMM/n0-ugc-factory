const {Readable}=require('node:stream');
const db=require('./_db');
const {requireProject}=require('./_project-auth');

function blobCredential(){
  return String(process.env.BLOB_READ_WRITE_TOKEN||process.env.VERCEL_OIDC_TOKEN||'');
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  let project;
  try{project=await requireProject(req)}catch{return res.status(401).json({error:'PROJECT_UNAUTHORIZED'})}
  const id=String(req.query&&req.query.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'INVALID_RENDER_ID'});
  const token=blobCredential();
  if(!token)return res.status(503).json({error:'BLOB_NOT_CONFIGURED'});

  try{
    const q=await db.query(
      "select r.blob_url,v.canonical_index from video_renders r join video_intelligence v on v.id=r.video_id "+
      "where r.id=$1 and r.generation_project_id=$2 and r.status='ready' limit 1",
      [id,project.id]
    );
    const row=q.rows[0];
    if(!row||!row.blob_url)return res.status(404).json({error:'RENDER_NOT_FOUND'});

    const upstream=await fetch(row.blob_url,{
      headers:{Authorization:'Bearer '+token,'User-Agent':'videoma-render-download/1.0'},
      signal:AbortSignal.timeout(30000)
    });
    if(!upstream.ok||!upstream.body)return res.status(502).json({error:'RENDER_BLOB_UNAVAILABLE'});

    res.setHeader('Content-Type',upstream.headers.get('content-type')||'video/mp4');
    const length=upstream.headers.get('content-length');
    if(length)res.setHeader('Content-Length',length);
    res.setHeader('Content-Disposition','attachment; filename="videoma-'+String(row.canonical_index).padStart(4,'0')+'.mp4"');
    res.setHeader('X-Content-Type-Options','nosniff');
    Readable.fromWeb(upstream.body).pipe(res);
  }catch(error){
    console.error('render-download',error&&error.message);
    if(!res.headersSent)return res.status(500).json({error:'RENDER_DOWNLOAD_FAILED'});
    res.destroy(error);
  }
};
