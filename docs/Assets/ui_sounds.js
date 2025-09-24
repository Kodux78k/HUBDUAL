
/**
 * Assets/ui_sounds.js
 * —————————————————————————————————————————
 * Pequeno engine de sons de UI para o HUB UNO.
 *
 * Recursos:
 * - Pré-carrega samples (wav/mp3/m4a), com fallback de extensão.
 * - AudioContext com "unlock" automático no primeiro toque (iOS/Safari).
 * - API global: UISounds.init(), UISounds.play(name), UISounds.map(sel, evt, name),
 *   UISounds.toggle(on), UISounds.volume(v), UISounds.autowire()
 * - Integração com LocalStorage (uno:uiSounds:on, uno:uiSounds:vol).
 * - Latência baixa (AudioBufferSourceNode), com fallback para <audio>.
 *
 * Estrutura esperada:
 *   /Assets/UISounds/   (coloque aqui seus arquivos .wav/.mp3/.m4a)
 *     click.wav  hover.wav  open.mp3  close.mp3  success.m4a  warn.m4a  error.m4a  nav.mp3  back.mp3  tab.wav  drag.wav
 */
(function(){
  const LS_ON  = 'uno:uiSounds:on';   // '1' | '0'
  const LS_VOL = 'uno:uiSounds:vol';  // '0.0'..'1.0'
  const BASE   = (window.UISOUNDS_BASE || 'Assets/UISounds/').replace(/\/+$/,'/') + '';

  // Lista base de sons -> pode adicionar mais chaves aqui
  const CATALOG = {
    click:   ['click.wav','click.mp3','click.m4a'],
    hover:   ['hover.wav','hover.mp3','hover.m4a'],
    open:    ['open.mp3','open.m4a','open.wav'],
    close:   ['close.mp3','close.m4a','close.wav'],
    success: ['success.m4a','success.mp3','success.wav'],
    warn:    ['warn.m4a','warn.mp3','warn.wav'],
    error:   ['error.m4a','error.mp3','error.wav'],
    nav:     ['nav.mp3','nav.m4a','nav.wav'],
    back:    ['back.mp3','back.m4a','back.wav'],
    tab:     ['tab.wav','tab.mp3','tab.m4a'],
    drag:    ['drag.wav','drag.mp3','drag.m4a']
  };

  // Util
  const LS = {
    get(k,d){ try{ const v = localStorage.getItem(k); return v==null? d : v; }catch(e){ return d } },
    set(k,v){ try{ localStorage.setItem(k, String(v)) }catch(e){} }
  };

  // Estado
  let _ctx = null;
  let _gain = null;
  const _buffers = {};            // name -> AudioBuffer
  const _resolved = {};           // name -> url resolvido
  const _fallbackAudio = {};      // name -> HTMLAudioElement
  let _ready = false;
  let _on = LS.get(LS_ON,'1') !== '0';
  let _vol = Math.max(0, Math.min(1, parseFloat(LS.get(LS_VOL,'0.7')) || 0.7));

  // Inicializa AudioContext (on-demand)
  function ensureCtx(){
    if(_ctx) return true;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      _ctx = new AC();
      _gain = _ctx.createGain();
      _gain.gain.value = _vol;
      _gain.connect(_ctx.destination);
      return true;
    }catch(e){ return false; }
  }

  // iOS/Safari: desbloquear áudio no primeiro toque
  function unlock(){
    if(!_ctx) ensureCtx();
    if(!_ctx || !_ctx.resume) return;
    if(_ctx.state === 'running') return;
    _ctx.resume().catch(()=>{});
  }
  // auto-unlock on first interaction
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });

  // Tenta carregar um URL (retorna ArrayBuffer)
  async function fetchArrayBuffer(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.arrayBuffer();
  }

  // Resolve um arquivo testando várias extensões do catálogo
  async function resolveUrl(name){
    if(_resolved[name]) return _resolved[name];
    const list = CATALOG[name] || [];
    for (const f of list){
      const url = BASE + f;
      try { await fetch(url, { method:'HEAD' }); _resolved[name] = url; return url; }
      catch(e){ /* tenta próxima extensão */ }
    }
    // se HEAD falhar (CORS ou server), tente GET com fallback silencioso
    for (const f of list){
      const url = BASE + f;
      try { await fetch(url, { method:'GET' }); _resolved[name] = url; return url; }
      catch(e){}
    }
    throw new Error('Nenhum arquivo encontrado para: '+name);
  }

  async function loadOne(name){
    try{
      const url = await resolveUrl(name);
      // Primeiro tente WebAudio
      if(ensureCtx()){
        const buf = await fetchArrayBuffer(url);
        _buffers[name] = await _ctx.decodeAudioData(buf.slice(0)); // slice() para evitar neutered
        return true;
      }
      // Fallback: elemento <audio>
      const a = new Audio(); a.src = url; a.preload = 'auto';
      _fallbackAudio[name] = a;
      return true;
    }catch(e){
      console.warn('[UISounds] Falha ao carregar', name, e);
      return false;
    }
  }

  async function init(names){
    const keys = Array.isArray(names) && names.length ? names : Object.keys(CATALOG);
    const tasks = keys.map(loadOne);
    await Promise.all(tasks);
    _ready = true;
    return true;
  }

  function play(name, {volume=1.0, detune=0, rate=1.0}={}){
    if(!_on) return;
    // WebAudio
    if(_buffers[name] && ensureCtx()){
      const src = _ctx.createBufferSource();
      src.buffer = _buffers[name];
      const g = _ctx.createGain();
      g.gain.value = Math.max(0, Math.min(2, volume)) * _vol;
      src.connect(g).connect(_gain);
      if(src.detune) src.detune.value = detune;
      if(rate && typeof rate==='number') src.playbackRate.value = rate;
      try { src.start(0); } catch(e){}
      return;
    }
    // Fallback: <audio>
    const a = _fallbackAudio[name];
    if(a){
      try{
        a.currentTime = 0;
        a.volume = Math.max(0, Math.min(1, volume)) * _vol;
        a.play().catch(()=>{});
      }catch(e){}
    }
  }

  function toggle(on){
    _on = !!on;
    LS.set(LS_ON, _on ? '1' : '0');
  }
  function volume(v){
    if(typeof v!=='number') return _vol;
    _vol = Math.max(0, Math.min(1, v));
    if(_gain) _gain.gain.value = _vol;
    LS.set(LS_VOL, String(_vol));
    return _vol;
  }

  // Mapeia eventos para sons
  function map(selector, evt, name, opts){
    const els = Array.from(document.querySelectorAll(selector));
    els.forEach(el => {
      el.addEventListener(evt, () => play(name, opts), { passive: true });
    });
  }

  // Auto-wire comum: click/hover em .btn, navegação, fechar, etc.
  function autowire(){
    map('button, .btn', 'click', 'click');
    map('button, .btn', 'mouseenter', 'hover');
    // Botões já presentes no HUB UNO (ids comuns)
    const pairs = [
      ['#btnBack','click','back'],
      ['.tab[data-nav]','click','tab'],
      ['#btnBrain','click','nav'],
      ['#btnDownload','click','success'],
      ['[data-act="close"]','click','close']
    ];
    pairs.forEach(([sel,evt,name])=>{
      document.querySelectorAll(sel).forEach(el=>{
        el.addEventListener(evt, ()=> play(name), { passive:true });
      });
    });
  }

  // Expor API
  window.UISounds = { init, play, map, toggle, volume, autowire, unlock };
})();
