const PLACEMENTS={
  top:{x:.10,y:.075,w:.80},
  upper:{x:.10,y:.145,w:.80},
  lower:{x:.10,y:.585,w:.80},
  bottom:{x:.10,y:.715,w:.80}
};

const REGION_BOXES={
  'haut-gauche':{x:.00,y:.00,w:.34,h:.34},
  'haut-centre':{x:.33,y:.00,w:.34,h:.34},
  'haut-droite':{x:.66,y:.00,w:.34,h:.34},
  'centre-gauche':{x:.00,y:.33,w:.34,h:.34},
  'centre':{x:.33,y:.33,w:.34,h:.34},
  'centre-droite':{x:.66,y:.33,w:.34,h:.34},
  'bas-gauche':{x:.00,y:.66,w:.34,h:.34},
  'bas-centre':{x:.33,y:.66,w:.34,h:.34},
  'bas-droite':{x:.66,y:.66,w:.34,h:.34},
  'top-left':{x:.00,y:.00,w:.34,h:.34},
  'top-center':{x:.33,y:.00,w:.34,h:.34},
  'top-right':{x:.66,y:.00,w:.34,h:.34},
  'middle-left':{x:.00,y:.33,w:.34,h:.34},
  'middle':{x:.33,y:.33,w:.34,h:.34},
  'middle-right':{x:.66,y:.33,w:.34,h:.34},
  'bottom-left':{x:.00,y:.66,w:.34,h:.34},
  'bottom-center':{x:.33,y:.66,w:.34,h:.34},
  'bottom-right':{x:.66,y:.66,w:.34,h:.34}
};

function clamp(n,min=0,max=1){return Math.max(min,Math.min(max,Number(n)||0))}
function normalizeBox(box){
  if(!box||typeof box!=='object')return null;
  let x=Number(box.x),y=Number(box.y),w=Number(box.w),h=Number(box.h);
  if([x,y,w,h].some(v=>!Number.isFinite(v)))return null;
  if(Math.max(Math.abs(x),Math.abs(y),Math.abs(w),Math.abs(h))>1.5){
    x/=100;y/=100;w/=100;h/=100;
  }
  x=clamp(x);y=clamp(y);w=clamp(w,0,1-x);h=clamp(h,0,1-y);
  if(w<=.01||h<=.01)return null;
  return {x,y,w,h,frame:Math.max(1,Math.min(4,Math.round(Number(box.frame)||1))),confidence:clamp((Number(box.confidence)||100)/100)};
}
function boxesFromRegions(regions){
  return (regions||[]).map(x=>{
    const key=String(x||'').trim().toLowerCase();
    const b=REGION_BOXES[key];
    return b?{...b,frame:1,confidence:.6}:null;
  }).filter(Boolean);
}
function faceBoxes(video){
  const explicit=(video&&video.faceBoxes||[]).map(normalizeBox).filter(Boolean);
  if(explicit.length)return explicit;
  const regions=Array.isArray(video&&video.faceRegions)?video.faceRegions:[];
  const regionBoxes=regions.map(x=>typeof x==='object'?normalizeBox(x):null).filter(Boolean);
  return regionBoxes.length?regionBoxes:boxesFromRegions(regions);
}
function intersect(a,b){
  const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h);
  if(x2<=x1||y2<=y1)return 0;
  return (x2-x1)*(y2-y1);
}
function estimateLines(text,charsPerLine=21){
  const s=String(text||'').trim();
  if(!s)return 0;
  const words=s.split(/\s+/);let lines=1,count=0;
  for(const word of words){
    const n=word.length+(count?1:0);
    if(count&&count+n>charsPerLine){lines++;count=word.length}
    else count+=n;
  }
  return Math.max(1,Math.min(5,lines));
}
function textRect(placement,hook,secondLine,style='short'){
  const base=PLACEMENTS[placement]||PLACEMENTS.top;
  const primaryLines=estimateLines(hook,style==='wall'?28:20);
  const secondaryLines=secondLine?estimateLines(secondLine,24):0;
  // Font geometry converted from width-relative size into 9:16 height-relative size.
  const primaryLineH=(style==='wall'?.054:.066)*1.2/1.7778;
  const secondaryLineH=.05*1.2/1.7778;
  const gap=secondaryLines?.015:0;
  const h=Math.min(.32,primaryLines*primaryLineH+secondaryLines*secondaryLineH+gap+.018);
  let y=base.y;
  if(placement==='lower'||placement==='bottom')y=Math.max(.05,base.y-h*.15);
  return {x:base.x,y,w:base.w,h};
}
function occlusionPenalty(rect,boxes){
  if(!boxes.length)return 0;
  let worst=0,total=0;
  for(const face of boxes){
    const overlap=intersect(rect,face);
    if(!overlap)continue;
    const faceArea=Math.max(.001,face.w*face.h);
    const textArea=Math.max(.001,rect.w*rect.h);
    const faceCovered=overlap/faceArea;
    const textCovered=overlap/textArea;
    // Covering even a modest fraction of a face is expensive.
    const score=Math.min(100,faceCovered*180+textCovered*85)*(.75+.25*(face.confidence||1));
    worst=Math.max(worst,score);
    total+=score*.35;
  }
  return Math.min(100,worst+total);
}
function preferredBonus(placement,video){
  const preferred=String(video&&video.textSafeZone&&video.textSafeZone.preferred||'').toLowerCase();
  if(preferred===placement)return 12;
  if(preferred==='middle'&&(placement==='top'||placement==='bottom'))return 2;
  return 0;
}
function chooseLayout({video,hook,secondLine='',style='short',requestedPlacement=''}){
  const boxes=faceBoxes(video);
  const dense=boxes.some(b=>b.w*b.h>.18)||Number(video&&video.personCount||0)>1;
  const candidates=['top','bottom','upper','lower'].map(placement=>{
    const rect=textRect(placement,hook,secondLine,style);
    const penalty=occlusionPenalty(rect,boxes);
    let score=100-penalty+preferredBonus(placement,video);
    if(placement==='upper'||placement==='lower')score-=6;
    if(requestedPlacement===placement)score+=3;
    return {placement,rect,faceOcclusionPenalty:Math.round(penalty),score:Math.round(score)};
  }).sort((a,b)=>b.score-a.score);

  let chosen=candidates[0];
  let finalSecond=secondLine;
  let compact=false;

  if(chosen.faceOcclusionPenalty>12&&secondLine){
    const withoutSecond=['top','bottom','upper','lower'].map(placement=>{
      const rect=textRect(placement,hook,'',style);
      const penalty=occlusionPenalty(rect,boxes);
      let score=100-penalty+preferredBonus(placement,video);
      if(placement==='upper'||placement==='lower')score-=6;
      return {placement,rect,faceOcclusionPenalty:Math.round(penalty),score:Math.round(score)};
    }).sort((a,b)=>b.score-a.score)[0];
    if(withoutSecond.score>chosen.score+2){
      chosen=withoutSecond;finalSecond='';compact=true;
    }
  }

  // Unknown face data uses conservative rendering: no center, no walls, no second line on long hooks.
  if(!boxes.length){
    const safe=String(video&&video.textSafeZone&&video.textSafeZone.preferred||'');
    const placement=['top','bottom','upper','lower'].includes(safe)?safe:'top';
    chosen={placement,rect:textRect(placement,hook,'','short'),faceOcclusionPenalty:0,score:72};
    if(String(hook||'').length>54||dense){finalSecond='';compact=true}
    style='short';
  }

  const reject=chosen.faceOcclusionPenalty>=28;
  const fontScale=reject?.84:chosen.faceOcclusionPenalty>=12?.90:dense?.94:1;
  return {
    placement:chosen.placement,
    secondLine:finalSecond,
    style:style==='wall'&&!dense&&!reject?'wall':'short',
    faceOcclusionPenalty:chosen.faceOcclusionPenalty,
    layoutScore:chosen.score,
    fontScale,
    compact,
    reject,
    candidates
  };
}

module.exports={chooseLayout,faceBoxes,textRect,occlusionPenalty};
