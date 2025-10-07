/*! UNO • Showcase Patch — presets + vertical ECBG inside Brain
 *  - Adiciona seletor de presets na .arch-switcher (Blue‑1 / Soft / Strong / Off)
 *  - Cria card “ECBG Showcase” dentro do #v-brain com layout vertical (landing)
 *  - Resolve conflitos de BG garantindo ownership do #custom-bg
 */
(function () {
  const log = (...a)=>console.debug('[UNO:showcase]',...a);
  const $ = (sel, root=document)=>root.querySelector(sel);
  const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
  const LS = {
    get(k, d=null){ try{ const v = localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem(k); }catch(e){} }
  };

  function applyPreset(preset){
    const b = document.body;
    b.classList.remove('preset-blue1','preset-soft','preset-strong','preset-off');
    const cls = preset==='Blue‑1'?'preset-blue1':
                preset==='Cinematic Soft'?'preset-soft':
                preset==='Strong'?'preset-strong':'preset-off';
    b.classList.add(cls);
    LS.set('uno.overlayPreset', preset);
  }

  function initPresetMiniSelect(){
    const bar = $('.arch-switcher');
    if(!bar || $('#overlayPresetSelect')) return;
    const sel = document.createElement('select');
    sel.id = 'overlayPresetSelect';
    sel.className = 'preset-select';
    ['Off','Blue‑1','Cinematic Soft','Strong'].forEach(name=>{
      const o = document.createElement('option');
      o.value = name; o.textContent = name;
      sel.appendChild(o);
    });
    const saved = LS.get('uno.overlayPreset','Blue‑1');
    sel.value = saved;
    sel.addEventListener('change', ()=>applyPreset(sel.value));
    bar.appendChild(sel);
    applyPreset(saved);
    log('Preset mini-select ready');
  }

  // === ECBG Showcase (inside Brain) ===
  function ensureCustomBG(){ 
    let host = $('#custom-bg');
    if(!host){
      // fallback: cria container se não existir
      host = document.createElement('div');
      host.id = 'custom-bg';
      host.style.cssText = 'position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none';
      document.body.prepend(host);
    }
    return host;
  }

  function nukeBGChildren(host){
    host.querySelectorAll('#ecbgVideo,#ecbgImage').forEach(n=>n.remove());
  }

  function setBGImage(file){
    const host = ensureCustomBG();
    nukeBGChildren(host);
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.id = 'ecbgImage';
    img.src = url;
    img.alt = 'Background Image';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    host.appendChild(img);
    LS.set('uno.ecbg', {type:'image', src:url});
  }

  async function setBGVideoFile(file){
    const host = ensureCustomBG();
    nukeBGChildren(host);
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.id = 'ecbgVideo';
    v.src = url;
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    host.appendChild(v);
    try{ await v.play(); }catch(e){}
    LS.set('uno.ecbg', {type:'video', src:url});
  }

  async function setBGWebcam(){
    const host = ensureCustomBG();
    nukeBGChildren(host);
    const v = document.createElement('video');
    v.id = 'ecbgVideo';
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    host.appendChild(v);
    try{
      const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:false});
      v.srcObject = stream;
      await v.play();
      LS.set('uno.ecbg', {type:'webcam'});
    }catch(e){
      v.remove();
      alert('Permissão de câmera negada.');
    }
  }

  function resetBG(){
    const host = ensureCustomBG();
    nukeBGChildren(host);
    LS.del('uno.ecbg');
  }

  function restoreBG(){
    const s = LS.get('uno.ecbg', null);
    if(!s) return;
    if(s.type==='image'){
      const img = document.createElement('img');
      img.id='ecbgImage'; img.src=s.src; img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;';
      ensureCustomBG().appendChild(img);
    }else if(s.type==='video'){
      const v = document.createElement('video');
      v.id='ecbgVideo'; v.src=s.src; v.autoplay=true; v.loop=true; v.muted=true; v.playsInline=true;
      v.style.cssText='width:100%;height:100%;object-fit:cover;display:block;';
      ensureCustomBG().appendChild(v);
      v.play().catch(()=>{});
    }else if(s.type==='webcam'){
      setBGWebcam();
    }
  }

  function buildECBGCard(){
    const brain = $('#v-brain .grid');
    if(!brain || $('#ecbgCard')) return;

    // Hidden inputs
    const fileImg = document.createElement('input'); fileImg.type='file'; fileImg.accept='image/*'; fileImg.style.display='none'; fileImg.id='ecbgImgInput';
    const fileVid = document.createElement('input'); fileVid.type='file'; fileVid.accept='video/*'; fileVid.style.display='none'; fileVid.id='ecbgVidInput';
    document.body.append(fileImg, fileVid);

    const card = document.createElement('div');
    card.id = 'ecbgCard';
    card.className = 'fx-trans fx-lift';

    card.innerHTML = `
      <div class="hdr">
        <div class="title">ECBG • Showcase</div>
        <div class="mut">Landing vertical · câmera / imagem / vídeo · presets</div>
      </div>
      <div class="hero">
        <div class="preview" id="ecbgPreview">
          <div class="hint">preview usa #custom-bg</div>
        </div>
        <div class="buttons">
          <button class="btn fx-trans fx-press ring" id="btnCam">
            <img alt="cam" src="https://cdn.jsdelivr.net/npm/@tabler/icons@2.47.0/icons/outline/camera.svg">Webcam
          </button>
          <button class="btn fx-trans fx-press ring" id="btnImg">
            <img alt="img" src="https://cdn.jsdelivr.net/npm/@tabler/icons@2.47.0/icons/outline/photo.svg">Imagem
          </button>
          <button class="btn fx-trans fx-press ring" id="btnVid">
            <img alt="vid" src="https://cdn.jsdelivr.net/npm/@tabler/icons@2.47.0/icons/outline/player-play.svg">Vídeo
          </button>
          <button class="btn fx-trans fx-press ring" id="btnReset">
            <img alt="reset" src="https://cdn.jsdelivr.net/npm/@tabler/icons@2.47.0/icons/outline/refresh.svg">Reset
          </button>
        </div>
      </div>
      <div class="mut">Dica: salve seu preset preferido. Ele volta sozinho no próximo load.</div>
    `;

    brain.prepend(card);

    // Bind
    $('#btnCam', card).addEventListener('click', setBGWebcam);
    $('#btnImg', card).addEventListener('click', ()=>fileImg.click());
    $('#btnVid', card).addEventListener('click', ()=>fileVid.click());
    $('#btnReset', card).addEventListener('click', resetBG);
    fileImg.addEventListener('change', e=>{ const f=e.target.files?.[0]; if(f) setBGImage(f); e.target.value=''; });
    fileVid.addEventListener('change', e=>{ const f=e.target.files?.[0]; if(f) setBGVideoFile(f); e.target.value=''; });

    log('ECBG card injected');
  }

  function boot(){
    initPresetMiniSelect();
    buildECBGCard();
    restoreBG();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();