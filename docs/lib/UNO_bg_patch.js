
/*! UNO • BG Patch + ARC Dim (drop-in)
 *  - Resolve conflito entre BGs (image x video)
 *  - Autoplay vídeo (muted/inline) + persistência
 *  - Toggle "arc-dim" (leve) em runtime + atalho
 *  - BG Studio (iframe) com ponte via postMessage
 */
(() => {
  const LS_BG = 'uno.customBg';
  const LS_DIM = 'uno.arcDim';

  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  function setBGMode(mode){ // 'video' | 'image' | null
    if(mode) document.body.setAttribute('data-bg-mode', mode);
    else document.body.removeAttribute('data-bg-mode');
  }

  function setBackgroundMedia(cfg, persist=true){
    const host = byId('custom-bg');
    if(!host) return console.warn('[UNO_BG] #custom-bg não encontrado.');
    host.replaceChildren();
    const src = cfg?.src || '';
    const type = (cfg?.type) || (/\.(mp4|webm|mov|m4v|ogv)$/i.test(src) ? 'video' : 'image');

    setBGMode(type);

    if(type === 'video'){
      const v = document.createElement('video');
      v.src = src;
      if (cfg.poster) v.poster = cfg.poster;
      v.autoplay = true;
      v.loop = cfg.loop ?? true;
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('webkit-playsinline','');
      v.preload = 'auto';
      if (cfg.playbackRate) v.playbackRate = cfg.playbackRate;
      host.appendChild(v);
      v.addEventListener('canplay', () => v.play().catch(() => {}), { once:true });
    } else {
      const img = new Image();
      img.src = src;
      img.decoding = 'async';
      img.loading = 'eager';
      host.appendChild(img);
    }

    // filtros / overlay opcionais
    if (cfg.filterCss) host.style.filter = cfg.filterCss; else host.style.removeProperty('filter');
    if (cfg.tint)      host.style.background = cfg.tint;  else host.style.removeProperty('background');

    if(persist){
      const save = { type, src, poster: cfg.poster || null, filterCss: cfg.filterCss || null, tint: cfg.tint || null, loop: cfg.loop ?? true, playbackRate: cfg.playbackRate || 1 };
      localStorage.setItem(LS_BG, JSON.stringify(save));
    }
  }

  function applySavedBackground(){
    try{
      const saved = JSON.parse(localStorage.getItem(LS_BG) || 'null');
      if(saved && saved.src) setBackgroundMedia(saved, false);
    }catch{}
  }

  function injectArcDimToggle(){
    // estado inicial
    const dimOn = localStorage.getItem(LS_DIM) === '1';
    document.body.classList.toggle('arc-dim', dimOn);

    // injeta controle no Brain (cartão de Tema & Fundo) se existir
    const themeSelect = byId('themeSelect') || $('[id*=theme]');
    if(themeSelect && !byId('arcDimToggle')){
      const card = themeSelect.closest('.card') || themeSelect.parentElement;
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;user-select:none';
      wrap.innerHTML = '<input id="arcDimToggle" type="checkbox" style="width:18px;height:18px"><span>ARC leve (dim)</span>';
      card.appendChild(wrap);
      const cb = byId('arcDimToggle');
      cb.checked = dimOn;
      cb.addEventListener('change', () => {
        document.body.classList.toggle('arc-dim', cb.checked);
        localStorage.setItem(LS_DIM, cb.checked ? '1' : '0');
      });
    }

    // atalho: Ctrl/Cmd + L
    document.addEventListener('keydown', e => {
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='l'){
        const on = document.body.classList.toggle('arc-dim');
        localStorage.setItem(LS_DIM, on ? '1':'0');
        const cb = byId('arcDimToggle'); if(cb) cb.checked = on;
      }
    });
  }

  function hookBgUpload(){
    const input = byId('bgUpload');
    if(!input) return;
    input.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if(!f) return;
      const url = URL.createObjectURL(f);
      const type = f.type.startsWith('video') ? 'video' : 'image';
      setBackgroundMedia({ type, src: url });
    });
  }

  function hookThemeSelect(){
    const sel = byId('themeSelect');
    if(!sel) return;
    sel.addEventListener('change', () => {
      // Mantemos o #custom-bg ativo em todos os temas;
      // quem define a presença do BG é o usuário via upload/Studio.
      // Isso evita “sumir” o vídeo ao trocar tema.
      const host = byId('custom-bg');
      if(host) host.style.display = 'block';
    });
  }

  function injectBGStudio(){
    if(byId('bgStudio')) return;
    const modal = document.createElement('div');
    modal.id = 'bgStudio';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="panel" style="width:min(920px,96vw);height:min(76vh, 700px);display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <strong>BG • Studio</strong>
          <div style="display:flex;gap:8px">
            <button id="bgStudioClear" class="btn fx-trans fx-press ring">Limpar BG</button>
            <button id="bgStudioClose" class="btn fx-trans fx-press ring">Fechar</button>
          </div>
        </div>
        <iframe id="bgStudioFrame" src="bg-showcase.html" style="flex:1 1 auto;border:1px solid #ffffff22;border-radius:12px;background:#000"></iframe>
      </div>`;
    document.body.appendChild(modal);

    // botão para abrir no Brain (Tema & Fundo)
    const anchor = byId('themeSelect')?.closest('.card') || byId('v-brain') || document.body;
    if(!byId('openBGStudio')){
      const btn = document.createElement('button');
      btn.id = 'openBGStudio';
      btn.className = 'btn fx-trans fx-press ring';
      btn.textContent = 'Abrir BG • Studio';
      btn.style.marginTop = '8px';
      anchor.appendChild(btn);
      btn.addEventListener('click', () => modal.classList.add('open'));
    }
    byId('bgStudioClose').addEventListener('click', () => modal.classList.remove('open'));
    byId('bgStudioClear').addEventListener('click', () => {
      const host = byId('custom-bg');
      if(host){ host.replaceChildren(); host.style.removeProperty('filter'); host.style.removeProperty('background'); }
      localStorage.removeItem(LS_BG);
      setBGMode(null);
      window.postMessage({ type: 'BG_STUDIO_CLEARED' }, '*');
    });

    // ponte: recebe comandos do Studio
    window.addEventListener('message', (ev) => {
      const d = ev.data || {};
      if(d.type === 'SET_BG'){
        setBackgroundMedia(d.payload);
      } else if(d.type === 'SET_BG_FILTER'){
        const host = byId('custom-bg');
        if(host){
          host.style.filter = d.payload?.css || '';
          try{
            const saved = JSON.parse(localStorage.getItem(LS_BG) || '{}');
            if(saved) localStorage.setItem(LS_BG, JSON.stringify({ ...saved, filterCss: d.payload?.css || null }));
          }catch{}
        }
      } else if(d.type === 'CLEAR_BG'){
        const host = byId('custom-bg');
        if(host){ host.replaceChildren(); host.style.removeProperty('filter'); host.style.removeProperty('background'); }
        localStorage.removeItem(LS_BG);
        setBGMode(null);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    applySavedBackground();
    injectArcDimToggle();
    hookBgUpload();
    hookThemeSelect();
    injectBGStudio();
  });

  // API global opcional
  window.UNO_BG = { set: setBackgroundMedia };
})();
