const {Pool}=require('pg');
const {attachDatabasePool}=require('@vercel/functions');
const {SCHEMA_SQL}=require('./_schema');

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

function getPool(){
  if(!configured()){
    const e=new Error('DATABASE_NOT_CONFIGURED');
    e.code='DATABASE_NOT_CONFIGURED';
    throw e;
  }
  if(!pool){
    pool=new Pool({
      connectionString:process.env.DATABASE_URL,
      max:3,
      idleTimeoutMillis:10000,
      connectionTimeoutMillis:8000,
      ssl:process.env.DATABASE_SSL==='false'?undefined:{rejectUnauthorized:false}
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
  if(!schemaPromise){
    schemaPromise=(async()=>{
      try{
        await getPool().query(SCHEMA_SQL);
        return true;
      }catch(err){
        schemaPromise=null;
        throw err;
      }
    })();
  }
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
