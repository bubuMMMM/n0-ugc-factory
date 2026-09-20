const {credential,openaiCredential,openaiJson,DIRECT_MODEL}=require('./_ai');
const {gatewayError,isTimeout}=require('./_gateway-errors');

const JEV_MODEL=process.env.VIDEOMA_EVALUATOR_MODEL||'typesafe-ai/jev';
const ENDPOINT='https://ai-gateway.vercel.sh/v1/evaluate';
let jevBlockedUntil=0;

async function evaluateJev(state,questions){
  const token=credential();
  if(Date.now()<jevBlockedUntil)throw new Error('JEV_GATEWAY_CIRCUIT_OPEN');
  if(!token){
    const e=new Error('AI_GATEWAY_NOT_CONFIGURED');
    e.code='AI_GATEWAY_NOT_CONFIGURED';
    throw e;
  }
  let r;
  try{
    r=await fetch(ENDPOINT,{
    method:'POST',
    headers:{
      'Authorization':'Bearer '+token,
      'Content-Type':'application/json',
      'User-Agent':'videoma/1.0'
    },
    body:JSON.stringify({
      model:JEV_MODEL,
      state,
      questions,
      providerOptions:{
        gateway:{
          zeroDataRetention:true,
          only:['typesafe-ai']
        }
      }
    }),
      signal:AbortSignal.timeout(60000)
    });
  }catch(error){
    if(isTimeout(error)){const e=new Error('JEV_TIMEOUT');e.code='JEV_TIMEOUT';throw e}
    throw error;
  }
  const raw=await r.text();
  if(!r.ok){
    const error=gatewayError(raw,r.status,'JEV_EVALUATION_ERROR');
    if(String(error.message)==='AI_GATEWAY_INSUFFICIENT_FUNDS'||String(error.message)==='AI_GATEWAY_AUTH_ERROR')jevBlockedUntil=Date.now()+5*60*1000;
    throw error;
  }
  let data;
  try{data=JSON.parse(raw)}catch{throw new Error('JEV_INVALID_RESPONSE')}
  if(!data||!data.answers)throw new Error('JEV_EMPTY_RESPONSE');
  return data;
}

function scoreQuestion(instructions){
  return {
    type:'score',
    instructions,
    criteria:[
      'failure: clearly does not satisfy the criterion',
      'weak: substantial problems',
      'acceptable: usable but ordinary or imperfect',
      'strong: clearly satisfies the criterion',
      'excellent: unusually strong and specific'
    ]
  };
}
function scoreTo100(answer){
  const value=Number(answer&&answer.score);
  if(!Number.isFinite(value))return 0;
  return Math.max(0,Math.min(100,Math.round(value/4*100)));
}

function hookQuestions(){
  return {
    visualFit:scoreQuestion('Does this on-screen hook fit this exact visible reaction, action, focus, and timing rather than any generic reaction video?'),
    brandFit:scoreQuestion('Is the hook tightly grounded in the supplied verified brand signal and brand context?'),
    hookStrength:scoreQuestion('Would the line create a strong reason to keep watching through curiosity, tension, usefulness, identity, proof, or another appropriate retention mechanism?'),
    specificity:scoreQuestion('Is the hook concrete and specific rather than vague, generic, or interchangeable?'),
    naturalness:scoreQuestion('Does the wording sound like natural TikTok/Instagram language from a real person rather than AI copy or an advertisement?'),
    claimSafety:scoreQuestion('Are all factual claims supported by the supplied brand evidence, without invented numbers, credentials, results, guarantees, testimonials, or transformations?'),
    novelty:scoreQuestion('Is the hook meaningfully distinct from the previously used hooks and non-cliché?'),
    readability:scoreQuestion('Is the text immediately readable on a short vertical video, concise enough for its chosen format, and easy to understand in one pass?'),
    emotionMatch:scoreQuestion('Does the emotional tone of the words match the visible reaction and energy of the clip?'),
    accept:{
      type:'boolean',
      instructions:'Should this hook be automatically accepted for production without human review?',
      criteria:{
        true:'The hook is visually specific, brand-grounded, natural, readable, safe, non-generic, and its emotional mechanism matches the clip.',
        false:'Any important mismatch, generic wording, unsupported claim, repetition, awkward wording, weak retention, or uncertainty remains.'
      }
    }
  };
}

function openAiEvalSchema(){
  const scoreProps={};
  for(const key of ['visualFit','brandFit','hookStrength','specificity','naturalness','claimSafety','novelty','readability','emotionMatch']){
    scoreProps[key]={type:'integer',minimum:0,maximum:100};
  }
  return {
    type:'object',
    properties:{
      scores:{
        type:'object',
        properties:scoreProps,
        required:Object.keys(scoreProps),
        additionalProperties:false
      },
      acceptProbability:{type:'number',minimum:0,maximum:1},
      rationale:{type:'string'}
    },
    required:['scores','acceptProbability','rationale'],
    additionalProperties:false
  };
}
async function evaluateWithOpenAI(state){
  if(!openaiCredential())throw new Error('OPENAI_API_NOT_CONFIGURED');
  const data=await openaiJson({
    name:'videoma_hook_quality_fallback',
    schema:openAiEvalSchema(),
    timeoutMs:90000,
    messages:[
      {
        role:'system',
        content:'You are a strict QA evaluator for short-form reaction-video hooks. Score only from the supplied structured evidence. Unsupported claims must score very low on claimSafety. A hook that covers or conflicts with the face/reaction should score low on visualFit and readability.'
      },
      {
        role:'user',
        content:'Evaluate this candidate independently. Return harsh scores and an acceptance probability. State:\n'+JSON.stringify(state)
      }
    ]
  });
  return {
    scores:data.scores,
    acceptProbability:Number(data.acceptProbability)||0,
    answers:{fallbackRationale:data.rationale||''},
    model:DIRECT_MODEL,
    usage:null,
    providerMetadata:{fallback:'direct-openai'},
    provider:'openai-fallback'
  };
}
async function evaluateHook({hook,secondLine,mechanism,visualAnchor,brandAnchor,placement,horizontalAlign,faceOcclusionPenalty,video,signal,brand,previousHooks}){
  const state={
    candidate:{
      hook,
      secondLine:secondLine||'',
      mechanism,
      visualAnchor,
      brandAnchor,
      placement:placement||'',
      horizontalAlign:horizontalAlign||'center',
      faceOcclusionPenalty:Number(faceOcclusionPenalty)||0
    },
    video:{
      scene:video&&video.scene||'',
      action:video&&video.action||'',
      reactionType:video&&video.reactionType||'',
      primaryEmotion:video&&video.primaryEmotion||'',
      energyScore:video&&video.energyScore||0,
      reactionIntensity:video&&video.reactionIntensity||0,
      visualFocus:video&&video.visualFocus||'',
      gestures:video&&video.gestures||[],
      objects:video&&video.objects||[],
      hasPhone:Boolean(video&&video.hasPhone),
      hasComputer:Boolean(video&&video.hasComputer),
      hasProduct:Boolean(video&&video.hasProduct),
      hookCompatibility:video&&video.hookCompatibility||[],
      peakReason:video&&video.peakReason||'',
      textSafeZone:video&&video.textSafeZone||{},
      faceRegions:video&&video.faceRegions||[],
      objectRegions:video&&video.objectRegions||[]
    },
    matchedBrandSignal:signal||{},
    brand:{
      name:brand&&brand.brand||'',
      summary:brand&&brand.summary||'',
      primaryOffer:brand&&brand.primaryOffer||'',
      claimsAllowed:brand&&brand.claimsAllowed||[],
      claimsForbidden:brand&&brand.claimsForbidden||[]
    },
    previousHooks:(previousHooks||[]).slice(-40)
  };

  try{
    const result=await evaluateJev(state,hookQuestions());
    const scores={};
    for(const key of ['visualFit','brandFit','hookStrength','specificity','naturalness','claimSafety','novelty','readability','emotionMatch']){
      scores[key]=scoreTo100(result.answers[key]);
    }
    const acceptProbability=Math.max(0,Math.min(1,Number(result.answers.accept&&result.answers.accept.probability)||0));
    return {
      scores,
      acceptProbability,
      answers:result.answers,
      model:result.model||JEV_MODEL,
      usage:result.usage||null,
      providerMetadata:result.providerMetadata||null,
      provider:'jev'
    };
  }catch(error){
    if(!openaiCredential())throw error;
    console.warn('Jev fallback to direct OpenAI',String(error&&error.message||error));
    return evaluateWithOpenAI(state);
  }
}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let cursor=0;
  async function worker(){
    while(cursor<items.length){
      const i=cursor++;
      try{out[i]=await fn(items[i],i)}catch(error){out[i]={error}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));
  return out;
}

module.exports={evaluateJev,evaluateHook,mapLimit,JEV_MODEL};
