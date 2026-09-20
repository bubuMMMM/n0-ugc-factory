const GATEWAY_URL='https://ai-gateway.vercel.sh/v1/chat/completions';
const MODEL=process.env.VIDEOMA_AI_MODEL||'openai/gpt-5.6-sol';

function credential(){
  return process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||'';
}

async function gatewayJson({messages,name,schema,timeoutMs=55000}){
  const token=credential();
  if(!token){
    const e=new Error('AI_GATEWAY_NOT_CONFIGURED');
    e.code='AI_GATEWAY_NOT_CONFIGURED';
    throw e;
  }
  const response=await fetch(GATEWAY_URL,{
    method:'POST',
    headers:{
      'Authorization':'Bearer '+token,
      'Content-Type':'application/json',
      'User-Agent':'videoma/1.0'
    },
    body:JSON.stringify({
      model:MODEL,
      messages,
      response_format:{
        type:'json_schema',
        json_schema:{name,strict:true,schema}
      }
    }),
    signal:AbortSignal.timeout(timeoutMs)
  });
  const body=await response.text();
  if(!response.ok){
    const e=new Error('AI_GATEWAY_ERROR');
    e.status=response.status;
    e.detail=body.slice(0,800);
    throw e;
  }
  let data;
  try{data=JSON.parse(body)}catch{throw new Error('AI_GATEWAY_INVALID_RESPONSE')}
  const content=data?.choices?.[0]?.message?.content;
  if(!content) throw new Error('AI_GATEWAY_EMPTY_RESPONSE');
  try{return JSON.parse(content)}catch{throw new Error('AI_GATEWAY_INVALID_JSON')}
}

module.exports={gatewayJson,MODEL,credential};
