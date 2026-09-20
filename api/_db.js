const {Pool}=require('pg');

let pool=null;
function configured(){return Boolean(process.env.DATABASE_URL)}
function getPool(){
  if(!configured()){
    const e=new Error('DATABASE_NOT_CONFIGURED');e.code='DATABASE_NOT_CONFIGURED';throw e;
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
async function query(text,params=[]){return getPool().query(text,params)}
function vectorLiteral(values){
  if(!Array.isArray(values)||!values.length)throw new Error('INVALID_VECTOR');
  return '['+values.map(v=>Number.isFinite(Number(v))?Number(v):0).join(',')+']';
}
module.exports={configured,query,vectorLiteral};
