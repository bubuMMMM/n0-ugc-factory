const {Pool}=require('pg');
const {SCHEMA_SQL}=require('./_schema');

let pool=null;
let schemaPromise=null;

function configured(){return Boolean(process.env.DATABASE_URL)}

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

module.exports={configured,getPool,ensureSchema,query,vectorLiteral};
