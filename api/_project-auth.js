const crypto=require('node:crypto');
const db=require('./_db');

function hash(value){return crypto.createHash('sha256').update(String(value||'')).digest('hex')}
function domainOf(raw){try{return new URL(raw).hostname.toLowerCase()}catch{return ''}}
function projectTokenFrom(req){return String(req.headers&&req.headers['x-project-token']||'').trim()}
function clientKey(req){
  const forwarded=String(req.headers&&req.headers['x-forwarded-for']||'').split(',')[0].trim();
  const real=String(req.headers&&req.headers['x-real-ip']||'').trim();
  const ua=String(req.headers&&req.headers['user-agent']||'').slice(0,240);
  return hash((forwarded||real||'unknown')+'|'+ua);
}
async function rateLimit(scope,keyHash,limit,windowSeconds){
  if(!db.configured())return {allowed:true,hits:0,limit};
  const now=Math.floor(Date.now()/1000);
  const windowStart=Math.floor(now/windowSeconds)*windowSeconds;
  const r=await db.query(
    "insert into api_rate_limits(scope,key_hash,window_start,hits) values($1,$2,$3,1) "+
    "on conflict(scope,key_hash,window_start) do update set hits=api_rate_limits.hits+1,updated_at=now() "+
    "returning hits",
    [scope,keyHash,windowStart]
  );
  const hits=Number(r.rows[0]&&r.rows[0].hits||0);
  return {allowed:hits<=limit,hits,limit,retryAfter:windowStart+windowSeconds-now};
}
async function limitAnonymous(req,scope,limit=5,windowSeconds=3600){
  return rateLimit(scope,clientKey(req),limit,windowSeconds);
}
async function issueProject({brandProfileId,website}){
  if(!db.configured()||!brandProfileId)return null;
  const token=crypto.randomBytes(32).toString('base64url');
  await db.query(
    "insert into generation_projects(token_hash,brand_profile_id,website,domain) values($1,$2,$3,$4)",
    [hash(token),brandProfileId,String(website||''),domainOf(website)]
  );
  return token;
}
async function authenticateProject(req){
  if(!db.configured())return null;
  const token=projectTokenFrom(req);
  if(!token)return null;
  const r=await db.query(
    "select p.id,p.brand_profile_id,p.website,p.domain,p.expires_at,b.profile "+
    "from generation_projects p join brand_profiles b on b.id=p.brand_profile_id "+
    "where p.token_hash=$1 and p.status='active' and p.expires_at>now() limit 1",
    [hash(token)]
  );
  return r.rows[0]||null;
}
async function requireProject(req){
  const project=await authenticateProject(req);
  if(!project){
    const e=new Error('PROJECT_UNAUTHORIZED');e.code='PROJECT_UNAUTHORIZED';throw e;
  }
  return project;
}
async function limitProject(project,scope,limit=120,windowSeconds=3600){
  return rateLimit('project:'+scope,hash(project.id),limit,windowSeconds);
}
module.exports={issueProject,authenticateProject,requireProject,limitAnonymous,limitProject};
