function norm(value){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function verticalClass(region){
  const r=norm(region);
  const low=/\bbas\b|bottom|lower|inferieur/.test(r);
  const high=/\bhaut\b|top|superieur/.test(r);
  const center=/centre|center|middle|milieu/.test(r);
  const spansCenter=/\ba\b centre|vers le centre|to center/.test(r);
  if(low&&center)return 'lowcenter';
  if(high&&center)return spansCenter?'highcenter':'high';
  if(low)return 'low';
  if(high)return 'high';
  if(center)return 'center';
  return 'unknown';
}
function facePenalty(faceRegions,placement){
  const regions=(faceRegions||[]).map(verticalClass);
  if(!regions.length)return placement==='top'?12:18;
  let penalty=0;
  for(const cls of regions){
    let p=18;
    if(placement==='top'){
      p=cls==='high'?92:cls==='highcenter'?82:cls==='center'?38:cls==='lowcenter'?14:cls==='low'?5:18;
    }else if(placement==='upper'){
      p=cls==='high'?78:cls==='highcenter'?82:cls==='center'?72:cls==='lowcenter'?30:cls==='low'?10:25;
    }else if(placement==='lower'){
      p=cls==='low'?92:cls==='lowcenter'?82:cls==='center'?62:cls==='highcenter'?24:cls==='high'?7:20;
    }else p=90;
    penalty=Math.max(penalty,p);
  }
  return penalty;
}
function normalizePreferred(value){
  value=norm(value);
  if(value==='lower'||value==='bas'||value==='bottom')return 'lower';
  if(value==='top'||value==='haut')return 'top';
  if(value==='upper')return 'top';
  return null;
}
function resolveLayout(intelligence={},options={}){
  const zone=intelligence.textSafeZone||{};
  const faces=Array.isArray(intelligence.faceRegions)?intelligence.faceRegions:[];
  const requested=normalizePreferred(options.requested)||normalizePreferred(zone.preferred);
  const candidates=['top','lower'].map(placement=>({
    placement,
    faceOcclusionPenalty:facePenalty(faces,placement)
  }));
  for(const c of candidates){
    const preferred=requested===c.placement?14:0;
    const avoid=(zone.avoid||[]).map(norm);
    const avoided=avoid.some(x=>c.placement==='top'?/haut|top/.test(x):/bas|bottom|lower/.test(x));
    c.score=Math.max(0,100-c.faceOcclusionPenalty+preferred-(avoided?35:0));
  }
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  const people=Math.max(0,Number(intelligence.personCount)||0);
  const configuredAllow=typeof zone.allowSecondLine==='boolean'?zone.allowSecondLine:null;
  const allowSecondLine=configuredAllow!==null
    ? configuredAllow&&best.faceOcclusionPenalty<=18
    : best.faceOcclusionPenalty<=12&&people<=1&&faces.length<=2;
  const maxLines=Math.max(1,Math.min(3,Number(zone.maxLines)||(allowSecondLine?2:1)));
  return {
    placement:best.placement,
    faceOcclusionPenalty:best.faceOcclusionPenalty,
    layoutScore:Math.round(best.score),
    allowSecondLine,
    maxLines,
    compact:best.faceOcclusionPenalty>10||people>1,
    safe:best.faceOcclusionPenalty<=22,
    reason:zone.reason||''
  };
}
module.exports={resolveLayout,facePenalty};
