const BANDS={
  top:{x:.10,y:.07,w:.80,h:.17},
  upper:{x:.10,y:.14,w:.80,h:.20},
  middle:{x:.10,y:.36,w:.80,h:.22},
  lower:{x:.10,y:.54,w:.80,h:.18},
  bottom:{x:.10,y:.64,w:.80,h:.16}
};
const PLACEMENTS=['top','upper','lower','bottom','middle'];

function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,Number(n)||0))}
function overlap(a,b){
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
  const r=Math.min(a.x+a.w,b.x+b.w),bot=Math.min(a.y+a.h,b.y+b.h);
  if(r<=x||bot<=y)return 0;
  return (r-x)*(bot-y);
}
function boxArea(b){return Math.max(.0001,(Number(b.w)||0)*(Number(b.h)||0))}
function regionPenalty(region,placement){
  const s=String(region||'').toLowerCase();
  if(!s)return 0;
  if(placement==='top'&&/(haut|top)/.test(s))return 90;
  if(placement==='upper'&&/(haut|top|centre|center)/.test(s))return 78;
  if(placement==='middle'&&/(centre|center|milieu|middle)/.test(s))return 96;
  if(placement==='lower'&&/(bas|bottom|centre|center)/.test(s))return 62;
  if(placement==='bottom'&&/(bas|bottom)/.test(s))return 75;
  return 0;
}
function facePenalty(intelligence,placement){
  const band=BANDS[placement]||BANDS.lower;
  const regions=Array.isArray(intelligence&&intelligence.faceRegions)?intelligence.faceRegions:[];
  let penalty=0;
  for(const item of regions){
    if(typeof item==='string'){
      penalty=Math.max(penalty,regionPenalty(item,placement));
      continue;
    }
    if(!item||typeof item!=='object')continue;
    const boxes=Array.isArray(item.boxes)?item.boxes:
      Number.isFinite(Number(item.x))?[item]:[];
    for(const raw of boxes){
      const b={x:Number(raw.x)||0,y:Number(raw.y)||0,w:Number(raw.w)||0,h:Number(raw.h)||0};
      const ov=overlap(b,band);
      if(ov<=0)continue;
      const ratio=Math.min(1,ov/boxArea(b));
      penalty=Math.max(penalty,Math.round(55+45*ratio));
    }
  }
  return clamp(penalty);
}
function zoneScore(intelligence,placement){
  const safe=intelligence&&intelligence.textSafeZone||{};
  const scores=safe.zoneScores||safe.zones||{};
  if(Number.isFinite(Number(scores[placement])))return clamp(scores[placement]);
  const avoid=Array.isArray(safe.avoid)?safe.avoid.map(x=>String(x).toLowerCase()):[];
  if(avoid.some(x=>x.includes(placement)))return 10;
  if(String(safe.preferred||'')===placement)return 92;
  const defaults={top:72,upper:54,middle:24,lower:84,bottom:76};
  return defaults[placement]||50;
}
function layoutDecision(intelligence,requested='lower',hasSecondLine=false,style='short'){
  const candidates=PLACEMENTS.map(placement=>{
    const safety=zoneScore(intelligence,placement);
    const face=facePenalty(intelligence,placement);
    const middlePenalty=placement==='middle'?22:0;
    const requestedBonus=placement===requested?5:0;
    const score=safety-face-middlePenalty+requestedBonus;
    return {placement,safety,faceOcclusionPenalty:face,score};
  }).sort((a,b)=>b.score-a.score);

  let best=candidates[0]||{placement:'lower',safety:70,faceOcclusionPenalty:0,score:70};
  if(!intelligence||!Object.keys(intelligence).length){
    best={placement:'lower',safety:72,faceOcclusionPenalty:12,score:60};
  }
  const safe=intelligence&&intelligence.textSafeZone||{};
  const maxLines=Math.max(1,Math.min(4,Number(safe.maxLines)||2));
  const explicitSecond=safe.secondLineSafe===true;
  const allowSecondLine=Boolean(
    hasSecondLine &&
    intelligence &&
    best.faceOcclusionPenalty<=12 &&
    best.safety>=86 &&
    maxLines>=2 &&
    (explicitSecond||safe.secondLineSafe==null)
  );
  const scale=style==='wall'
    ? (best.faceOcclusionPenalty>15?.82:.92)
    : (best.faceOcclusionPenalty>20?.80:best.safety<80?.88:1);
  return {
    placement:best.placement,
    faceOcclusionPenalty:best.faceOcclusionPenalty,
    layoutScore:clamp(best.safety-best.faceOcclusionPenalty),
    allowSecondLine,
    maxLines:Math.min(maxLines,allowSecondLine?3:2),
    scale:Number(scale.toFixed(2))
  };
}
module.exports={BANDS,layoutDecision,facePenalty,zoneScore};
