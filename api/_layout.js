function norm(value){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function facePenalty(faceRegions,placement){
  const regions=(faceRegions||[]).map(norm);
  if(!regions.length)return placement==='top'?12:18;
  let penalty=0;
  for(const r of regions){
    const high=/haut|top/.test(r),center=/centre|center|middle/.test(r),low=/bas|bottom|lower/.test(r);
    let p=0;
    if(placement==='top')p=high?95:center?28:low?4:18;
    else if(placement==='upper')p=high?78:center?72:low?12:25;
    else if(placement==='lower')p=low?88:center?58:high?8:22;
    else p=90;
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
