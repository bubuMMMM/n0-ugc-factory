function norm(value){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function horizontalClass(region){
  const r=norm(region);
  const left=/gauche|left/.test(r);
  const right=/droite|right/.test(r);
  if(left&&!right)return 'left';
  if(right&&!left)return 'right';
  if(left&&right)return 'wide';
  return 'center';
}
function preferredHorizontal(intelligence){
  const zone=intelligence.textSafeZone||{};
  const explicit=norm(zone.horizontal);
  if(['left','gauche'].includes(explicit))return 'left';
  if(['right','droite'].includes(explicit))return 'right';
  if(['center','centre'].includes(explicit))return 'center';
  const classes=(intelligence.faceRegions||[]).map(horizontalClass);
  const left=classes.filter(x=>x==='left').length;
  const right=classes.filter(x=>x==='right').length;
  const center=classes.filter(x=>x==='center'||x==='wide').length;
  if(center)return 'center';
  if(left&&!right)return 'right';
  if(right&&!left)return 'left';
  return 'center';
}
function horizontalFactor(region,align){
  const cls=horizontalClass(region);
  if(cls==='center'||cls==='wide'||align==='center')return 1;
  if((cls==='left'&&align==='right')||(cls==='right'&&align==='left'))return .28;
  return 1;
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
function facePenalty(faceRegions,placement,horizontalAlign='center'){
  const rawRegions=faceRegions||[];
  const regions=rawRegions.map(verticalClass);
  if(!regions.length)return placement==='top'?12:18;
  let penalty=0;
  for(let i=0;i<regions.length;i++){
    const cls=regions[i];
    let p=18;
    if(placement==='top'){
      p=cls==='high'?92:cls==='highcenter'?82:cls==='center'?38:cls==='lowcenter'?14:cls==='low'?5:18;
    }else if(placement==='upper'){
      p=cls==='high'?78:cls==='highcenter'?82:cls==='center'?72:cls==='lowcenter'?30:cls==='low'?10:25;
    }else if(placement==='lower'){
      p=cls==='low'?92:cls==='lowcenter'?82:cls==='center'?62:cls==='highcenter'?24:cls==='high'?7:20;
    }else p=90;
    p=Math.round(p*horizontalFactor(rawRegions[i],horizontalAlign));
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
  const horizontalAlign=preferredHorizontal(intelligence);
  const candidates=['top','lower'].map(placement=>({
    placement,
    horizontalAlign,
    faceOcclusionPenalty:facePenalty(faces,placement,horizontalAlign)
  }));
  for(const c of candidates){
    const preferred=requested===c.placement?14:0;
    const avoid=(zone.avoid||[]).map(norm);
    const avoided=avoid.some(x=>c.placement==='top'?/haut|top/.test(x):/bas|bottom|lower/.test(x));
    c.score=Math.max(0,Math.min(100,100-c.faceOcclusionPenalty+preferred-(avoided?35:0)));
  }
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  const people=Math.max(0,Number(intelligence.personCount)||0);
  const configuredAllow=typeof zone.allowSecondLine==='boolean'?zone.allowSecondLine:null;
  const allowSecondLine=configuredAllow!==null
    ? configuredAllow&&best.faceOcclusionPenalty<=18
    : false;
  const maxLines=Math.max(1,Math.min(3,Number(zone.maxLines)||(allowSecondLine?2:1)));
  return {
    placement:best.placement,
    horizontalAlign:best.horizontalAlign,
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
