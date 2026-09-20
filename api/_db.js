const {Pool}=require('pg');
const {attachDatabasePool}=require('@vercel/functions');
const {MIGRATIONS}=require('./_schema');

let pool=null;
let schemaPromise=null;

function parseDatabaseUrl(){
  const raw=String(process.env.DATABASE_URL||'').trim();
  if(!raw)return {ok:false,error:'DATABASE_URL_MISSING'};
  try{
    const u=new URL(raw);
    if(!['postgres:','postgresql:'].includes(u.protocol))return {ok:false,error:'DATABASE_URL_INVALID_PROTOCOL'};
    if(!u.hostname||u.hostname==='base')return {ok:false,error:'DATABASE_URL_INVALID_HOST'};
    if(!u.username)return {ok:false,error:'DATABASE_URL_MISSING_USER'};
    return {ok:true,hostname:u.hostname,database:u.pathname.replace(/^\//,'')||'',sslmode:u.searchParams.get('sslmode')||''};
  }catch{return {ok:false,error:'DATABASE_URL_INVALID_FORMAT'}}
}
function configured(){return parseDatabaseUrl().ok}
function normalizedConnectionString(){
  const raw=String(process.env.DATABASE_URL||'').trim();
  try{
    const u=new URL(raw);
    u.searchParams.delete('sslmode');
    return u.toString();
  }catch{return raw}
}
function sslConfig(){
  if(process.env.DATABASE_SSL==='false')return false;
  if(process.env.DATABASE_SSL_INSECURE==='true')return {rejectUnauthorized:false};
  return {rejectUnauthorized:true};
}
function getPool(){
  if(!configured()){
    const e=new Error('DATABASE_NOT_CONFIGURED');
    e.code='DATABASE_NOT_CONFIGURED';
    throw e;
  }
  if(!pool){
    pool=new Pool({
      connectionString:normalizedConnectionString(),
      max:3,
      idleTimeoutMillis:10000,
      connectionTimeoutMillis:8000,
      ssl:sslConfig()
    });
    try{attachDatabasePool(pool)}catch{}
  }
  return pool;
}

async function ensureSchema(){
  if(!configured()){
    const e=new Error('DATABASE_NOT_CONFIGURED');
    e.code='DATABASE_NOT_CONFIGURED';
    throw e;
  }
  if(schemaPromise)return schemaPromise;

  schemaPromise=(async()=>{
    const client=await getPool().connect();
    try{
      await client.query("select pg_advisory_lock(hashtext('videoma_schema_migrations'))");
      await client.query(
        "create table if not exists videoma_schema_migrations ("+
        "id text primary key, applied_at timestamptz not null default now())"
      );
      const appliedResult=await client.query("select id from videoma_schema_migrations");
      const applied=new Set(appliedResult.rows.map(r=>r.id));
      for(const migration of MIGRATIONS){
        if(applied.has(migration.id))continue;
        await client.query('begin');
        try{
          await client.query(migration.sql);
          await client.query(
            "insert into videoma_schema_migrations(id) values($1) on conflict(id) do nothing",
            [migration.id]
          );
          await client.query('commit');
        }catch(error){
          try{await client.query('rollback')}catch{}
          throw error;
        }
      }
      return true;
    }catch(error){
      schemaPromise=null;
      throw error;
    }finally{
      try{await client.query("select pg_advisory_unlock(hashtext('videoma_schema_migrations'))")}catch{}
      client.release();
    }
  })();

  return schemaPromise;
}

async function query(text,params=[]){
  await ensureSchema();
  return getPool().query(text,params);
}

function vectorLiteral(values){
  if(!Array.isArray(values)||!values.length)throw new Error('INVALID_VECTOR');
  return '['+values.map(v=>Number.isFinite(Number(v))?Number(v):0).join(',')+']';
}

module.exports={configured,parseDatabaseUrl,getPool,ensureSchema,query,vectorLiteral};
