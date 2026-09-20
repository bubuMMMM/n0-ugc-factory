const {Readable}=require('node:stream');

const ALLOWED_HOST='doublespeed2.blob.core.windows.net';
function validate(raw){
  let u;try{u=new URL(String(raw||''))}catch{throw new Error('INVALID_URL')}
  if(u.protocol!=='https:'||u.hostname!==ALLOWED_HOST||!u.pathname.startsWith('/media/'))throw new Error('URL_NOT_ALLOWED');
  return u.href;
}

module.exports=async function handler(req,res){
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).end();
  let url;try{url=validate(req.query?.url)}catch{return res.status(400).json({error:'INVALID_VIDEO_URL'})}
  try{
    const headers={'User-Agent':'videoma-video-proxy/1.0','Accept-Encoding':'identity'};
    if(req.headers.range)headers.Range=req.headers.range;
    const upstream=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(20000)});
    if(!upstream.ok&&upstream.status!==206)return res.status(upstream.status).end();
    res.status(upstream.status);
    for(const key of ['content-type','content-length','content-range','accept-ranges','etag','last-modified']){
      const value=upstream.headers.get(key);if(value)res.setHeader(key,value);
    }
    res.setHeader('Cache-Control','public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin','*');
    if(req.method==='HEAD'||!upstream.body)return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  }catch(err){
    console.error('video proxy',err?.message);
    if(!res.headersSent)res.status(502).json({error:'VIDEO_PROXY_FAILED'});
    else res.end();
  }
};
