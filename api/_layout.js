function norm(value){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function clamp01(n){return Math.max(0,Math.min(1,Number(n)||0))}
function isBox(value){
  return value&&typeof value==='object'&&
    Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y))&&
    Number.isFinite(Number(value.w))&&Number.isFinite(Number(value.h));
}
function box(value,padX=0,padY=0){
  const x=clamp01(value.x),y=clamp01(value.y),w=clamp01(value.w),h=clamp01(value.h);
  const left=Math.max(0,x-padX),top=Math.max(0,y-padY);
  const right=Math.min(1,x+w+padX),bottom=Math.min(1,y+h+padY);
  return {x:left,y:top,w:Math.max(0,right-left),h:Math.max(0,bottom-top)};
}
function area(r){return Math.max(0,r.w)*Math.max(0,r.h)}
function intersection(a,b){
  const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y);
  const x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h);
  return {x:x1,y:y1,w:Math.max(0,x2-x1),h:Math.max(0,y2-y1)};
}
function centerInside(inner,outer){
  const cx=inner.x+inner.w/2,cy=inner.y+inner.h/2;
  return cx>=outer.x&&cx<=outer.x+outer.w&&cy>=outer.y&&cy<=outer.y+outer.h;
}
function horizontalClass(region){
  const r=norm(region);
  const left=/gauche|left/.test(r),right=/droite|right/.test(r);
  if(left&&!right)return 'left';
  if(right&&!left)return 'right';
  if(left&&right)return 'wide';
  return 'center';
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
function legacyPenalty(faceRegions,placement,horizontalAlign='center'){
  const raw=(faceRegions||[]).filter(x=>typeof x==='string');
  if(!raw.length)return placement==='top'?12:18;
  let penalty=0;
  for(const region of raw){
    const cls=verticalClass(region);
    const hc=horizontalClass(region);
    let p=18;
    if(placement==='top')p=cls==='high'?92:cls==='highcenter'?82:cls==='center'?38:cls==='lowcenter'?14:cls==='low'?5:18;
    else if(placement==='lower')p=cls==='low'?92:cls==='lowcenter'?82:cls==='center'?62:cls==='highcenter'?24:cls==='high'?7:20;
    else p=90;
    if(horizontalAlign!=='center'&&hc!=='center'&&hc!=='wide'&&hc!==horizontalAlign)p=Math.round(p*.28);
    penalty=Math.max(penalty,p);
  }
  return penalty;
}
function estimatedTextGeometry(options={},align='center'){
  const hook=String(options.hook||'');
  const second=String(options.secondLine||'');
  const style=options.style==='wall'?'wall':'short';
  const width=align==='center'?.78:.56;
  const charsPerLine=style==='wall'
    ? Math.max(20,Math.round(width*47))
    : Math.max(14,Math.round(width*37));
  const primaryLines=Math.max(1,Math.min(style==='wall'?5:3,Math.ceil(Math.max(1,hook.length)/charsPerLine)));
  const secondLines=second?Math.max(1,Math.min(2,Math.ceil(second.length/Math.max(14,Math.round(width*42))))):0;
  let height=(style==='wall'?.055:.062)*primaryLines;
  if(secondLines)height+=.026+.048*secondLines;
  height+=.035;
  let fontScale=1;
  if(primaryLines>=3)fontScale=.88;
  if(style==='wall')fontScale=.86;
  return {width,height:Math.min(.28,Math.max(.095,height)),primaryLines,secondLines,fontScale};
}
function candidateRect(placement,align,geometry){
  const w=geometry.width;
  const x=align==='left'?.055:align==='right'?1-.055-w:(1-w)/2;
  const y=placement==='top'?.065:Math.max(.43,.71-geometry.height);
  return {x,y,w,h:geometry.height};
}
function facePenaltyFromBoxes(faceRegions,textRect){
  const faces=(faceRegions||[]).filter(isBox);
  if(!faces.length)return null;
  let penalty=0;
  for(const raw of faces){
    const f=box(raw,.028,.022);
    const overlap=intersection(f,textRect);
    const ia=area(overlap);
    if(!ia)continue;
    const relative=ia/Math.max(.0001,Math.min(area(f),area(textRect)));
    let p=Math.min(100,Math.round(30+relative*85));
    if(centerInside(f,textRect))p=Math.max(p,92);
    penalty=Math.max(penalty,p);
  }
  return penalty;
}
function objectPenaltyFromBoxes(objectRegions,textRect){
  const objects=(objectRegions||[]).filter(isBox);
  let penalty=0;
  for(const raw of objects){
    const importance=Math.max(0,Math.min(100,Number(raw.importance)||50))/100;
    const o=box(raw,.018,.018);
    const ia=area(intersection(o,textRect));
    if(!ia)continue;
    const relative=ia/Math.max(.0001,Math.min(area(o),area(textRect)));
    penalty=Math.max(penalty,Math.round(relative*70*importance));
  }
  return penalty;
}
function preferredHorizontal(intelligence){
  const zone=intelligence.textSafeZone||{};
  const explicit=norm(zone.horizontal);
  if(['left','gauche'].includes(explicit))return 'left';
  if(['right','droite'].includes(explicit))return 'right';
  if(['center','centre'].includes(explicit))return 'center';

  const boxes=(intelligence.faceRegions||[]).filter(isBox);
  if(boxes.length){
    const avg=boxes.reduce((sum,b)=>sum+clamp01(b.x)+clamp01(b.w)/2,0)/boxes.length;
    if(avg<.43)return 'right';
    if(avg>.57)return 'left';
    return 'center';
  }

  const classes=(intelligence.faceRegions||[]).filter(x=>typeof x==='string').map(horizontalClass);
  const left=classes.filter(x=>x==='left').length,right=classes.filter(x=>x==='right').length;
  const center=classes.filter(x=>x==='center'||x==='wide').length;
  if(center)return 'center';
  if(left&&!right)return 'right';
  if(right&&!left)return 'left';
  return 'center';
}
function normalizePreferred(value){
  value=norm(value);
  if(value==='lower'||value==='bas'||value==='bottom')return 'lower';
  if(value==='top'||value==='haut'||value==='upper')return 'top';
  return null;
}
function evaluateCandidates(intelligence,options,includeSecondLine){
  const zone=intelligence.textSafeZone||{};
  const requested=normalizePreferred(options.requested)||normalizePreferred(zone.preferred);
  const preferredAlign=preferredHorizontal(intelligence);
  const avoids=(zone.avoid||[]).map(norm);
  const faceRegions=Array.isArray(intelligence.faceRegions)?intelligence.faceRegions:[];
  const objectRegions=Array.isArray(intelligence.objectRegions)?intelligence.objectRegions:[];
  const hasBoxes=faceRegions.some(isBox);
  const alignments=hasBoxes?['center','left','right']:[preferredAlign,'center',preferredAlign==='left'?'right':'left'];
  const uniqueAlign=[...new Set(alignments)];
  const candidates=[];

  for(const placement of ['top','lower']){
    for(const horizontalAlign of uniqueAlign){
      const geometry=estimatedTextGeometry({...options,secondLine:includeSecondLine?options.secondLine:''},horizontalAlign);
      const textRect=candidateRect(placement,horizontalAlign,geometry);
      const boxPenalty=facePenaltyFromBoxes(faceRegions,textRect);
      const faceOcclusionPenalty=boxPenalty===null?legacyPenalty(faceRegions,placement,horizontalAlign):boxPenalty;
      const objectPenalty=objectPenaltyFromBoxes(objectRegions,textRect);
      const avoided=avoids.some(x=>placement==='top'?/haut|top/.test(x):/bas|bottom|lower/.test(x));
      const preference=requested===placement?7:0;
      const alignBonus=horizontalAlign===preferredAlign?4:0;
      const score=Math.max(0,Math.min(100,
        100-faceOcclusionPenalty-(objectPenalty*.28)+(preference+alignBonus)-(avoided?30:0)
      ));
      candidates.push({
        placement,horizontalAlign,textRect,
        faceOcclusionPenalty,objectPenalty,
        layoutScore:Math.round(score),
        fontScale:geometry.fontScale,
        estimatedLines:geometry.primaryLines+geometry.secondLines
      });
    }
  }
  candidates.sort((a,b)=>
    b.layoutScore-a.layoutScore||
    a.faceOcclusionPenalty-b.faceOcclusionPenalty||
    (a.horizontalAlign==='center'?-1:1)
  );
  return candidates;
}
function resolveLayout(intelligence={},options={}){
  const zone=intelligence.textSafeZone||{};
  const withSecond=Boolean(options.secondLine);
  let candidates=evaluateCandidates(intelligence,options,withSecond);
  let best=candidates[0];
  let allowSecondLine=withSecond;

  if(withSecond){
    const without=evaluateCandidates(intelligence,options,false)[0];
    const secondUnsafe=best.faceOcclusionPenalty>8||best.layoutScore<84;
    const materiallyBetter=without.faceOcclusionPenalty+5<best.faceOcclusionPenalty||without.layoutScore>=best.layoutScore+8;
    if(secondUnsafe||materiallyBetter){
      best=without;
      allowSecondLine=false;
    }
  }

  const configuredAllow=typeof zone.allowSecondLine==='boolean'?zone.allowSecondLine:null;
  if(configuredAllow===false)allowSecondLine=false;
  if(configuredAllow===true&&best.faceOcclusionPenalty<=5&&best.layoutScore>=90&&withSecond)allowSecondLine=true;

  const people=Math.max(0,Number(intelligence.personCount)||0);
  const maxLines=Math.max(1,Math.min(3,Number(zone.maxLines)||(allowSecondLine?2:1)));
  const compact=best.faceOcclusionPenalty>0||people>1||best.fontScale<1||best.estimatedLines>2;
  return {
    placement:best.placement,
    horizontalAlign:best.horizontalAlign,
    textRect:best.textRect,
    faceOcclusionPenalty:best.faceOcclusionPenalty,
    objectOcclusionPenalty:best.objectPenalty,
    layoutScore:best.layoutScore,
    allowSecondLine,
    maxLines,
    compact,
    fontScale:best.fontScale,
    safe:best.faceOcclusionPenalty===0||best.faceOcclusionPenalty<=8,
    reason:zone.reason||''
  };
}
function facePenalty(faceRegions,placement,horizontalAlign='center'){
  const geometry=estimatedTextGeometry({},horizontalAlign);
  const rect=candidateRect(placement,horizontalAlign,geometry);
  const p=facePenaltyFromBoxes(faceRegions||[],rect);
  return p===null?legacyPenalty(faceRegions||[],placement,horizontalAlign):p;
}
module.exports={resolveLayout,facePenalty};
