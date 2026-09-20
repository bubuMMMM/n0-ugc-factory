const {gatewayJson,MODEL}=require('../_ai');
const {embedMany,EMBEDDING_MODEL}=require('../_embedding');
const db=require('../_db');
const {transcribeVideoUrl}=require('../_transcribe');

const VERSION='video-intel-v1';
const MAX_BATCH=5;
const ALLOWED_VIDEO_HOST='doublespeed2.blob.core.windows.net';

function authorized(req){
  const secret=process.env.PREANALYZE_SECRET;
  return Boolean(secret)&&req.headers['x-admin-secret']===secret;
}
function safeVideoUrl(raw){
  let u;try{u=new URL(String(raw||''))}catch{throw new Error('INVALID_VIDEO_URL')}
  if(u.protocol!=='https:'||u.hostname!==ALLOWED_VIDEO_HOST||!u.pathname.startsWith('/media/'))throw new Error('INVALID_VIDEO_URL');
  return u.href;
}
function s(v,n=300){return String(v||'').replace(/\s+/g,' ').trim().slice(0,n)}
function schema(count){
  return {
    type:'object',
    properties:{
      videos:{type:'array',minItems:count,maxItems:count,items:{
        type:'object',
        properties:{
          index:{type:'integer'},
          scene:{type:'string'},
          action:{type:'string'},
          primaryEmotion:{type:'string'},
          emotions:{type:'array',items:{type:'string'}},
          objects:{type:'array',items:{type:'string'}},
          gestures:{type:'array',items:{type:'string'}},
          personCount:{type:'integer',minimum:0,maximum:20},
          hasPhone:{type:'boolean'},
          hasComputer:{type:'boolean'},
          hasProduct:{type:'boolean'},
          gazeDirection:{type:'string'},
          reactionIntensity:{type:'integer',minimum:0,maximum:100},
          energyScore:{type:'integer',minimum:0,maximum:100},
          versatilityScore:{type:'integer',minimum:0,maximum:100},
          reactionType:{type:'string'},
          visualFocus:{type:'string'},
          peakFrame:{type:'integer',minimum:1,maximum:4},
          peakReason:{type:'string'},
          textSafeZone:{
            type:'object',
            properties:{
              preferred:{type:'string',enum:['top','upper','middle','lower']},
              avoid:{type:'array',items:{type:'string'}},
              reason:{type:'string'}
            },
            required:['preferred','avoid','reason'],additionalProperties:false
          },
          faceRegions:{type:'array',items:{type:'string'}},
          objectRegions:{type:'array',items:{type:'string'}},
          hookCompatibility:{type:'array',items:{type:'string'}},
          tags:{type:'array',items:{type:'string'}},
          analysisConfidence:{type:'integer',minimum:0,maximum:100}
        },
        required:['index','scene','action','primaryEmotion','emotions','objects','gestures','personCount','hasPhone','hasComputer','hasProduct','gazeDirection','reactionIntensity','energyScore','versatilityScore','reactionType','visualFocus','peakFrame','peakReason','textSafeZone','faceRegions','objectRegions','hookCompatibility','tags','analysisConfidence'],
        additionalProperties:false
      }}
    },
    required:['videos'],additionalProperties:false
  };
}
function analysisPrompt(){
  return `Analyse ces vidéos de réaction verticales UNE SEULE FOIS pour construire une base permanente.

Chaque image est une planche de 4 frames du même clip, de gauche à droite: début, premier tiers, deuxième tiers, fin.

Tu ne connais aucune marque cliente à cette étape. Décris donc la vidéo de manière générique, factuelle et réutilisable.

Pour chaque vidéo:
- scène: décor, cadrage, sujet principal;
- action: ce qui change réellement entre les 4 frames;
- émotions observables, sans inférer d'état mental non visible;
- objets visibles importants;
- gestes: pointage, haussement d'épaules, tête dans les mains, regard téléphone, mains ouvertes, etc.;
- nombre approximatif de personnes;
- téléphone, ordinateur et produit clairement visible;
- direction du regard;
- reactionIntensity et energyScore de 0 à 100;
- reactionType parmi des catégories utiles telles que surprise, frustration, rire, validation, scepticisme, confusion, pointage, démonstration, découverte, réflexion, embarras, soulagement, calme, autre;
- visualFocus: le visage/objet/geste auquel le viewer regarde naturellement;
- peakFrame: 1 à 4, le moment visuel le plus exploitable;
- textSafeZone: choisis une zone qui évite visage, mains et objet principal sur LES QUATRE frames;
- faceRegions/objectRegions: zones grossières (haut-gauche, haut-centre, haut-droite, centre-gauche, centre, centre-droite, bas-gauche, bas-centre, bas-droite);
- hookCompatibility: mécanismes qui collent naturellement à cette réaction, parmi drama, story, credential, insider, numbered, diagnostic, inversion, overheard, confession, pov, value, take, fourthwall, transformation, wall, proof, pattern_break, product_natural, objection, pain, benefit, comparison, mistake, discovery;
- tags descriptifs;
- versatilityScore: capacité du clip à fonctionner pour de nombreuses marques sans forcer le sens.

Ne décris jamais une personne avec une identité, un âge exact, une origine ou un attribut sensible. Décris uniquement ce qui est utile au montage et au matching.
`;
}
function embeddingText(r,transcript){
  return [
    'scene '+r.scene,
    'action '+r.action,
    'emotion '+[r.primaryEmotion,...(r.emotions||[])].join(' '),
    'objects '+(r.objects||[]).join(' '),
    'gestures '+(r.gestures||[]).join(' '),
    'reaction '+r.reactionType,
    'focus '+r.visualFocus,
    'hook compatibility '+(r.hookCompatibility||[]).join(' '),
    'tags '+(r.tags||[]).join(' '),
    transcript?'transcript '+transcript:''
  ].filter(Boolean).join('\n');
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!authorized(req))return res.status(401).json({error:'UNAUTHORIZED'});
  if(!db.configured())return res.status(503).json({error:'DATABASE_NOT_CONFIGURED'});

  if(req.method==='GET'){
    try{
      const summary=await db.query(`select
        count(*)::int total,
        count(*) filter (where status='ready')::int ready,
        count(*) filter (where status='error')::int errors
        from video_intelligence`);
      const rows=await db.query(`select canonical_index,status from video_intelligence order by canonical_index`);
      return res.status(200).json({version:VERSION,...summary.rows[0],items:rows.rows});
    }catch(e){console.error(e);return res.status(500).json({error:'DATABASE_ERROR'})}
  }
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});

  const incoming=Array.isArray(req.body?.videos)?req.body.videos.slice(0,MAX_BATCH):[];
  if(!incoming.length)return res.status(400).json({error:'VIDEOS_REQUIRED'});
  let videos;
  try{
    videos=incoming.map(v=>({
      index:Number(v.index),
      url:safeVideoUrl(v.url),
      durationMs:Math.max(0,Math.round(Number(v.durationMs)||0)),
      contactSheet:String(v.contactSheet||''),
      keyframes:Array.isArray(v.keyframes)?v.keyframes.slice(0,4):[]
    }));
  }catch{return res.status(400).json({error:'INVALID_VIDEO_URL'})}
  if(videos.some(v=>!Number.isInteger(v.index)||v.index<1||!v.contactSheet.startsWith('data:image/')))return res.status(400).json({error:'INVALID_VIDEO_PAYLOAD'});

  try{
    await Promise.all(videos.map(v=>db.query(
      `insert into video_intelligence(canonical_index,source_url,duration_ms,analysis_version,status)
       values($1,$2,$3,$4,'processing')
       on conflict(canonical_index) do update set source_url=excluded.source_url,duration_ms=excluded.duration_ms,analysis_version=excluded.analysis_version,status='processing',error_message=null`,
      [v.index,v.url,v.durationMs,VERSION]
    )));

    const content=[{type:'text',text:analysisPrompt()}];
    for(const v of videos){
      content.push({type:'text',text:`VIDÉO #${v.index}`});
      content.push({type:'image_url',image_url:{url:v.contactSheet,detail:'low'}});
    }
    const analysis=await gatewayJson({
      name:'videoma_permanent_video_intelligence',
      schema:schema(videos.length),
      messages:[
        {role:'system',content:'Tu construis des métadonnées visuelles permanentes et réutilisables. Sois factuel, compact et cohérent entre les clips.'},
        {role:'user',content}
      ]
    });
    const byIndex=new Map((analysis.videos||[]).map(x=>[Number(x.index),x]));

    const transcripts=await Promise.all(videos.map(async v=>{
      try{return await transcribeVideoUrl(v.url)}catch(e){return {status:'error',text:'',reason:String(e.message||e)}}
    }));

    const embeddingTexts=videos.map((v,i)=>{
      const r=byIndex.get(v.index);if(!r)throw new Error('MISSING_VIDEO_ANALYSIS');
      return embeddingText(r,transcripts[i]?.text||'');
    });
    const embeddings=await embedMany(embeddingTexts);

    const saved=[];
    for(let i=0;i<videos.length;i++){
      const v=videos[i],r=byIndex.get(v.index),tr=transcripts[i]||{status:'unknown',text:''};
      const peakRatio=[.08,.34,.64,.9][Math.max(0,Math.min(3,(Number(r.peakFrame)||1)-1))];
      const peakMs=Math.round(v.durationMs*peakRatio);
      const vector=db.vectorLiteral(embeddings[i]);
      await db.query(
        `update video_intelligence set
          duration_ms=$2,status='ready',scene=$3,action=$4,primary_emotion=$5,emotions=$6,objects=$7,gestures=$8,
          person_count=$9,has_phone=$10,has_computer=$11,has_product=$12,gaze_direction=$13,reaction_intensity=$14,
          energy_score=$15,versatility_score=$16,reaction_type=$17,visual_focus=$18,peak_moment_ms=$19,peak_reason=$20,
          text_safe_zone=$21::jsonb,face_regions=$22::jsonb,object_regions=$23::jsonb,hook_compatibility=$24,tags=$25,
          keyframes=$26::jsonb,contact_sheet_data=$27,has_audio=$28,audio_status=$29,transcript=$30,
          embedding_text=$31,embedding_model=$32,embedding=$33::vector,raw_analysis=$34::jsonb,error_message=null,analyzed_at=now()
        where canonical_index=$1`,
        [
          v.index,v.durationMs,s(r.scene,500),s(r.action,500),s(r.primaryEmotion,100),
          r.emotions||[],r.objects||[],r.gestures||[],Number(r.personCount)||0,Boolean(r.hasPhone),Boolean(r.hasComputer),Boolean(r.hasProduct),
          s(r.gazeDirection,100),Number(r.reactionIntensity)||0,Number(r.energyScore)||0,Number(r.versatilityScore)||0,
          s(r.reactionType,80),s(r.visualFocus,180),peakMs,s(r.peakReason,300),JSON.stringify(r.textSafeZone||{}),
          JSON.stringify(r.faceRegions||[]),JSON.stringify(r.objectRegions||[]),r.hookCompatibility||[],r.tags||[],
          JSON.stringify(v.keyframes||[]),v.contactSheet,tr.status==='transcribed',tr.status,tr.text||'',
          embeddingTexts[i],EMBEDDING_MODEL,vector,JSON.stringify({...r,analysisConfidence:Number(r.analysisConfidence)||0})
        ]
      );
      saved.push({index:v.index,reactionType:r.reactionType,energyScore:r.energyScore,versatilityScore:r.versatilityScore,audioStatus:tr.status});
    }
    return res.status(200).json({saved,version:VERSION,model:MODEL,embeddingModel:EMBEDDING_MODEL});
  }catch(err){
    console.error('preanalyze error',err?.message,err?.detail||'');
    await Promise.allSettled(videos.map(v=>db.query(`update video_intelligence set status='error',error_message=$2 where canonical_index=$1`,[v.index,s(err?.message||'PREANALYZE_FAILED',400)])));
    const code=String(err?.message||'PREANALYZE_FAILED');
    return res.status(code==='AI_GATEWAY_NOT_CONFIGURED'?503:500).json({error:code});
  }
};
