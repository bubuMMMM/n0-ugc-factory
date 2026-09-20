const BANDS={
  top:{x:.10,y:.075,w:.80,h:.15},
  upper:{x:.10,y:.17,w:.80,h:.16},
  middle:{x:.10,y:.38,w:.80,h:.18},
  lower:{x:.10,y:.58,w:.80,h:.15},
  bottom:{x:.10,y:.73,w:.80,h:.13}
};
const COLUMNS={
  center:{x:.10,w:.80},
  left:{x:.06,w:.52},
  right:{x:.42,w:.52}
};
const PLACEMENTS=['top','lower','bottom','upper','middle'];
const ALIGNMENTS=['center','left','right'];

function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,Number(n)||0))}
function clamp01(n){return Math.max(0,Math.min(1,Number(n)||0))}
function overlap(a,b){
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
  const r=Math.min(a.x+a.w,b.x+b.w),bot=Math.min(a.y+a.h,b.y+b.h);
  if(r<=x||bot<=y)return 0;
  return (r-x)*(bot-y);
}
function boxArea(b){return Math.max(.0001,(Number(b.w)||0)*(Number(b.h)||0))}
function normalizedBox(raw){
  if(!raw||typeof raw!=='object')return null;
  const x=clamp01(raw.x),y=clamp01(raw.y),w=clamp01(raw.w),h=clamp01(raw.h);
  if(w<=0||h<=0)return null;
  return {x,y,w,h,confidence:clamp01(raw.confidence==null?1:raw.confidence)};
}
function boxesFrom(regions){
  const out=[];
  for(const item of Array.isArray(regions)?regions:[]){
    if(!item||typeof item!=='object')continue;
    if(Array.isArray(item.boxes)){
      for(const b of item.boxes){const n=normalizedBox(b);if(n)out.push(n)}
    }else{
      const n=normalizedBox(item);if(n)out.push(n);
    }
  }
  return out;
}
function stringRegionPenalty(region,placement,alignment='center'){
  const s=String(region||'').toLowerCase();
  if(!s)return 0;
  let p=0;
  if(placement==='top'&&/(haut|top)/.test(s))p=92;
  if(placement==='upper'&&/(haut|top|centre|center)/.test(s))p=Math.max(p,82);
  if(placement==='middle'&&/(centre|center|milieu|middle)/.test(s))p=Math.max(p,98);
  if(placement==='lower'&&/(bas|bottom|centre|center)/.test(s))p=Math.max(p,72);
  if(placement==='bottom'&&/(bas|bottom)/.test(s))p=Math.max(p,84);
  if(alignment==='left'&&/(gauche|left)/.test(s))p=Math.max(p,85);
  if(alignment==='right'&&/(droite|right)/.test(s))p=Math.max(p,85);
  return p;
}
function penaltyForRegions(regions,rect,placement,alignment,base=55,span=45){
  let penalty=0;
  const boxes=boxesFrom(regions);
  for(const b of boxes){
    const ov=overlap(b,rect);
    if(ov<=0)continue;
    const ratio=Math.min(1,ov/boxArea(b));
    penalty=Math.max(penalty,Math.round((base+span*ratio)*(b.confidence||1)));
  }
  for(const item of Array.isArray(regions)?regions:[]){
    if(typeof item==='string')penalty=Math.max(penalty,stringRegionPenalty(item,placement,alignment));
  }
  return clamp(penalty);
}
function facePenalty(intelligence,placement='lower',alignment='center',rect=null){
  const band=BANDS[placement]||BANDS.lower;
  const col=COLUMNS[alignment]||COLUMNS.center;
  const target=rect||{x:col.x,y:band.y,w:col.w,h:band.h};
  return penaltyForRegions(intelligence&&intelligence.faceRegions,target,placement,alignment,60,40);
}
function objectPenalty(intelligence,placement='lower',alignment='center',rect=null){
  const band=BANDS[placement]||BANDS.lower;
  const col=COLUMNS[alignment]||COLUMNS.center;
  const target=rect||{x:col.x,y:band.y,w:col.w,h:band.h};
  return penaltyForRegions(intelligence&&intelligence.objectRegions,target,placement,alignment,28,38);
}
function zoneScore(intelligence,placement){
  const safe=intelligence&&intelligence.textSafeZone||{};
  const scores=safe.zoneScores||safe.zones||{};
  if(Number.isFinite(Number(scores[placement])))return clamp(scores[placement]);
  const avoid=Array.isArray(safe.avoid)?safe.avoid.map(x=>String(x).toLowerCase()):[];
  if(avoid.some(x=>x===placement||x.includes(placement)))return 8;
  if(String(safe.preferred||'')===placement)return 94;
  const defaults={top:78,upper:60,middle:20,lower:84,bottom:80};
  return defaults[placement]||50;
}
function secondLineAllowed(safe,hasSecondLine,best){
  if(!hasSecondLine)return false;
  const explicit=
    typeof safe.allowSecondLine==='boolean'?safe.allowSecondLine:
    typeof safe.secondLineSafe==='boolean'?safe.secondLineSafe:null;
  const maxLines=Math.max(1,Math.min(4,Number(safe.maxLines)||2));
  if(explicit===false||maxLines<2)return false;
  return best.faceOcclusionPenalty<=8&&best.objectOcclusionPenalty<=20&&best.safety>=86;
}
function resolveLayout(intelligence={},options={}){
  const requested=PLACEMENTS.includes(options.requested)?options.requested:'lower';
  const style=options.style==='wall'?'wall':'short';
  const hasSecondLine=Boolean(options.secondLine);
  const candidates=[];

  for(const placement of PLACEMENTS){
    const band=BANDS[placement];
    for(const horizontalAlign of ALIGNMENTS){
      const col=COLUMNS[horizontalAlign];
      const textRect={x:col.x,y:band.y,w:col.w,h:band.h};
      const faceOcclusionPenalty=facePenalty(intelligence,placement,horizontalAlign,textRect);
      const objectOcclusionPenalty=objectPenalty(intelligence,placement,horizontalAlign,textRect);
      const safety=zoneScore(intelligence,placement);
      const middlePenalty=placement==='middle'?24:0;
      const requestedBonus=placement===requested?4:0;
      const sidePenalty=horizontalAlign==='center'?0:3;
      const score=safety-faceOcclusionPenalty-(objectOcclusionPenalty*.35)-middlePenalty-sidePenalty+requestedBonus;
      candidates.push({placement,horizontalAlign,textRect,faceOcclusionPenalty,objectOcclusionPenalty,safety,score});
    }
  }

  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0]||{
    placement:'bottom',horizontalAlign:'center',
    textRect:{x:.12,y:.74,w:.76,h:.11},
    faceOcclusionPenalty:100,objectOcclusionPenalty:0,safety:0,score:-100
  };

  const safe=intelligence&&intelligence.textSafeZone||{};
  const maxLines=Math.max(1,Math.min(4,Number(safe.maxLines)||2));
  const allowSecondLine=secondLineAllowed(safe,hasSecondLine,best);
  const noSafeZone=best.faceOcclusionPenalty>25||best.score<35;
  const compact=noSafeZone||best.faceOcclusionPenalty>8||best.safety<80||best.horizontalAlign!=='center';
  const fontScale=style==='wall'
    ? (compact?.72:.86)
    : (noSafeZone?.68:best.horizontalAlign!=='center'?.76:compact?.84:1);

  return {
    placement:best.placement,
    horizontalAlign:best.horizontalAlign,
    textRect:best.textRect,
    faceOcclusionPenalty:best.faceOcclusionPenalty,
    objectOcclusionPenalty:best.objectOcclusionPenalty,
    layoutScore:clamp(best.safety-best.faceOcclusionPenalty-(best.objectOcclusionPenalty*.35)),
    allowSecondLine,
    secondLineSuppressed:hasSecondLine&&!allowSecondLine,
    maxLines:allowSecondLine?Math.min(3,maxLines):Math.min(2,maxLines),
    fontScale:Number(fontScale.toFixed(2)),
    scale:Number(fontScale.toFixed(2)),
    compact,
    noSafeZone,
    safeForAutoApproval:!noSafeZone&&best.faceOcclusionPenalty<=8&&best.score>=55,
    candidates:candidates.slice(0,5)
  };
}
function layoutDecision(intelligence,requested='lower',hasSecondLine=false,style='short'){
  return resolveLayout(intelligence,{requested,secondLine:hasSecondLine?'1':'',style});
}

module.exports={BANDS,COLUMNS,PLACEMENTS,resolveLayout,layoutDecision,facePenalty,objectPenalty,zoneScore};
