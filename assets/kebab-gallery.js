/* One catalogue and one player for both uploaded clips and the legacy library. */
(function () {
  'use strict';
  const PREVIEW_LIMIT = 98;
  const uploads = [
    {id:'kebab-broche-097f153d',src:'/media/kebab/broche-097f153d.mp4',poster:'/media/kebab/broche-097f153d.jpg',hook:"La découpe qui donne faim avant même la première bouchée.",placement:'top'},
    {id:'kebab-voiture-3f655e32',src:'/media/kebab/voiture-3f655e32.mp4',poster:'/media/kebab/voiture-3f655e32.jpg',hook:"Tu avais prévu de manger chez toi. Tu n’as pas tenu jusque-là.",placement:'top'},
    {id:'kebab-pitas-44da836d',src:'/media/kebab/pitas-44da836d.mp4',poster:'/media/kebab/pitas-44da836d.jpg',hook:"Le plus dur ? Choisir lequel tu attaques en premier.",placement:'top'},
    {id:'kebab-degustation-e2827722',src:'/media/kebab/degustation-e2827722.mp4',poster:'/media/kebab/degustation-e2827722.jpg',hook:"La première bouchée. Tout le reste peut attendre.",placement:'top'},
    {id:'kebab-reaction',src:'/media/kebab/reaction-cbab9e5f.mp4',poster:'/media/kebab/reaction.jpg',embeddedText:true,hook:''},
    {id:'kebab-preparation',src:'/media/kebab/preparation.mp4',poster:'/media/kebab/preparation.jpg',hook:'Le moment où tu comprends que tu ne partageras pas ton kebab.',placement:'top'},
    {id:'kebab-street',src:'/media/kebab/street-89044c24.mp4',poster:'/media/kebab/street.jpg',hook:'Tu devais juste rentrer chez toi. Puis tu as croisé ce kebab.',placement:'lower'}
  ];
  const grid = document.getElementById('grid');
  const modal = document.getElementById('modal');
  const modalVideo = document.getElementById('modalVideo');
  const modalHook = document.getElementById('modalHook');
  const modalCount = document.getElementById('modalCount');
  const closeButton = document.getElementById('modalClose');
  const retryButton = document.getElementById('modalRetry');
  const loadState = document.getElementById('loadState');
  const hooksMeta = Array.isArray(window.VIDEOMA_DEMO_HOOKS) ? window.VIDEOMA_DEMO_HOOKS : [];
  const hooks = [
    'Tu pensais juste prendre un kebab. Tu viens de trouver ta nouvelle adresse.',
    'Quand la première bouchée confirme que tu as choisi le bon kebab.',
    'Le kebab que tu voulais garder secret… mais tes potes méritent de savoir.',
    'On m’a dit « teste ce kebab ». Je comprends mieux maintenant.',
    'Ton pote dit qu’il n’a pas faim. Puis il voit ton kebab.',
    'Une pause déjeuner, un kebab bien garni, et la journée repart.',
    'Ce moment où tu ouvres ton kebab et tu sais que tu vas revenir.',
    'Tu cherches une idée pour ce soir ? Ce kebab a une proposition.',
    'Quand tu trouves enfin le kebab qui te donne envie de revenir.',
    'Tu devais cuisiner ce soir. Ce kebab vient de changer le programme.',
    'Le plus dur avec ce kebab ? Attendre la première bouchée.'
  ];
  let videos = uploads.slice();
  let activeIndex = -1;
  let returnFocus = null;
  let wheelLocked = false;
  let touchStart = null;
  const visible = new Set();
  const cards = new Map();
  let generation = 0;

  function overlayOpen() {
    return modal.classList.contains('open') || document.getElementById('onboarding').classList.contains('open');
  }
  function configure(v) {
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('muted','');
    v.setAttribute('playsinline','');
    v.setAttribute('loop','');
  }
  function ensureSource(v) {
    if (!v.getAttribute('src') && v.dataset.src) {v.src = v.dataset.src;v.load();}
  }
  function playCard(v) {
    if (document.hidden || overlayOpen() || !visible.has(v)) return;
    const card = v.closest('.card');
    if (card.classList.contains('failed')) return;
    ensureSource(v);
    const attempt = v.play();
    if (attempt) attempt.catch(function (err) {
      if (err.name === 'AbortError') return;
      if (err.name === 'NotAllowedError') {
        card.classList.add('blocked');
        card.querySelector('.card-status').textContent='Toucher pour lire';
      }
    });
  }
  function syncPlayback() {
    cards.forEach(function(card) {
      const v=card.querySelector('video');
      if (!visible.has(v) || document.hidden || overlayOpen()) v.pause();
      else playCard(v);
    });
    if (document.hidden) modalVideo.pause();
    else if (modal.classList.contains('open')) playModal();
  }
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      const v=entry.target;
      if(entry.isIntersecting && entry.intersectionRatio>=0.1){visible.add(v);playCard(v);}
      else {visible.delete(v);v.pause();}
    });
  },{threshold:[0,0.1],rootMargin:'0px'});
  function hookFor(item){return item.embeddedText ? '' : item.hook;}
  function cardFor(item,index) {
    const card=document.createElement('button');
    card.type='button';
    card.className='card'+(item.poster?' has-poster':'')+(item.embeddedText?' embedded-text':'');
    card.dataset.videoId=item.id;
    card.setAttribute('aria-label','Ouvrir la vidéo '+(index+1));
    const v=document.createElement('video');
    configure(v);v.preload='none';v.dataset.src=item.src;
    if(item.poster)v.poster=item.poster;
    const skeleton=document.createElement('span');skeleton.className='skeleton';
    const number=document.createElement('span');number.className='card-index';number.textContent='#'+String(index+1).padStart(4,'0');
    const play=document.createElement('span');play.className='card-play';play.textContent='▶';
    const status=document.createElement('span');status.className='card-status';status.textContent='Vidéo indisponible. Toucher pour réessayer.';
    card.append(v,skeleton,number,play,status);
    if(hookFor(item)) {
      const h=document.createElement('span');h.className='card-hook '+(item.placement||'lower')+' '+(item.design||'outline');h.textContent=hookFor(item);card.append(h);
      const brand=document.createElement('span');brand.className='card-brand';brand.textContent='@votre.kebab';card.append(brand);
    }
    function ready(){card.classList.add('ready');card.classList.remove('failed');}
    v.addEventListener('loadeddata',ready);
    v.addEventListener('playing',function(){ready();card.classList.remove('blocked');});
    v.addEventListener('error',function(){
      if(!v.getAttribute('src'))return;
      card.classList.add('failed');
      status.textContent='Vidéo indisponible. Toucher pour réessayer.';
      console.warn('kebab media error',item.id,v.error&&v.error.code);
    });
    card.addEventListener('click',function(){
      if(card.classList.contains('failed')){card.classList.remove('failed');v.removeAttribute('src');}
      openVideo(index,card);
    });
    observer.observe(v);cards.set(item.id,card);return card;
  }
  function appendFrom(start) {
    const fragment=document.createDocumentFragment();
    for(let i=start;i<videos.length;i++)fragment.append(cardFor(videos[i],i));
    grid.append(fragment);
    modalCount.textContent=activeIndex>=0?(activeIndex+1)+' / '+videos.length:'';
  }
  function playModal() {
    const currentGeneration=generation;
    const attempt=modalVideo.play();
    if(attempt)attempt.catch(function(err){
      if(currentGeneration!==generation || err.name==='AbortError')return;
      retryButton.textContent=err.name==='NotAllowedError'?'Toucher pour lire':'Relancer la vidéo';
      retryButton.hidden=false;
    });
  }
  function openVideo(index,trigger) {
    if(index<0||index>=videos.length)return;
    if(trigger)returnFocus=trigger;
    activeIndex=index;generation++;
    const item=videos[index];
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    cards.forEach(card=>card.querySelector('video').pause());
    modalVideo.pause();configure(modalVideo);
    modalVideo.poster=item.poster||'';modalVideo.src=item.src;
    modalHook.className='modal-hook '+(item.placement||'lower')+' '+(item.design||'outline');
    modalHook.textContent=hookFor(item);modalHook.style.display=hookFor(item)?'block':'none';
    modal.querySelector('.modal-shade').style.display=item.embeddedText?'none':'';
    modalCount.textContent=(index+1)+' / '+videos.length;
    retryButton.hidden=true;modalVideo.load();playModal();
    if(trigger)closeButton.focus({preventScroll:true});
  }
  function closeModal(){
    generation++;
    modal.classList.remove('open');modal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';modalVideo.pause();
    modalVideo.removeAttribute('src');modalVideo.load();retryButton.hidden=true;
    syncPlayback();if(returnFocus)returnFocus.focus({preventScroll:true});
  }
  function step(dir){if(videos.length)openVideo((activeIndex+dir+videos.length)%videos.length);}
  modalVideo.addEventListener('error',function(){
    if(!modalVideo.getAttribute('src'))return;
    retryButton.hidden=false;retryButton.textContent='Vidéo indisponible. Réessayer';
  });
  modalVideo.addEventListener('playing',function(){retryButton.hidden=true;});
  retryButton.addEventListener('click',function(){openVideo(activeIndex);});
  closeButton.addEventListener('click',closeModal);
  document.getElementById('prev').addEventListener('click',function(){step(-1);});
  document.getElementById('next').addEventListener('click',function(){step(1);});
  document.addEventListener('keydown',function(e){
    if(!modal.classList.contains('open'))return;
    if(e.key==='Escape')closeModal();
    if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)) {e.preventDefault();step(['ArrowDown','ArrowRight'].includes(e.key)?1:-1);}
    if(e.key==='Tab'){
      const focusables=Array.from(modal.querySelectorAll('button')).filter(b=>!b.hidden);
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  modal.addEventListener('wheel',function(e){
    if(wheelLocked||Math.abs(e.deltaY)<18)return;
    wheelLocked=true;step(e.deltaY>0?1:-1);setTimeout(()=>{wheelLocked=false;},520);
  },{passive:true});
  modal.addEventListener('touchstart',function(e){touchStart={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};},{passive:true});
  modal.addEventListener('touchend',function(e){
    if(!touchStart)return;
    const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;
    if(Math.abs(dy)>50&&Math.abs(dy)>Math.abs(dx))step(dy<0?1:-1);
    touchStart=null;
  },{passive:true});
  document.addEventListener('visibilitychange',syncPlayback);
  new MutationObserver(syncPlayback).observe(document.getElementById('onboarding'),{attributes:true,attributeFilter:['class']});
  const sticky=document.getElementById('stickyCta');
  new IntersectionObserver(entries=>sticky.classList.toggle('hidden',entries[0].isIntersecting),{threshold:.15}).observe(document.querySelector('.hero'));
  const galleryTrigger=document.querySelector('[data-gallery]');
  if(galleryTrigger)galleryTrigger.addEventListener('click',()=>document.getElementById('videos').scrollIntoView({behavior:'smooth'}));
  // Uploaded clips remain usable even when the remote library cannot load.
  appendFrom(0);
  loadState.textContent=uploads.length+' vidéos kebab disponibles. Chargement des autres aperçus…';
  fetch('/videos.txt',{cache:'no-cache',signal:AbortSignal.timeout(15000)})
    .then(function(r){if(!r.ok)throw new Error('VIDEOS_HTTP_'+r.status);return r.text();})
    .then(function(text){
      const seen=new Set(videos.map(v=>v.src));
      const start=videos.length;
      text.split(/\r?\n/).forEach(function(line,sourceIndex){
        const src=line.trim();
        if(!src||seen.has(src)||videos.length>=PREVIEW_LIMIT)return;
        try {if(new URL(src).protocol!=='https:')return;}catch(e){return;}
        seen.add(src);
        const meta=hooksMeta[sourceIndex]||{};
        videos.push({id:'library-'+sourceIndex,src,hook:hooks[sourceIndex%hooks.length],placement:['top','upper','lower','bottom'].includes(meta.placement)?meta.placement:'lower',design:meta.design==='paper'?'paper':'outline'});
      });
      appendFrom(start);
      loadState.textContent=videos.length+' aperçus disponibles — lecture au défilement.';
    })
    .catch(function(err){console.warn('kebab catalogue',err.message);loadState.textContent='Les '+uploads.length+' vidéos kebab restent disponibles. Recharge la page pour les autres aperçus.';});
})();
