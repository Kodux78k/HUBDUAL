
/**
 * uno_voice_prompt_overlay.js
 * —————————————————————————————————————————
 * Patches suaves para:
 *  - Par de arquétipos (primário+secundário) real no prompt/system.
 *  - Parâmetros de voz (pitch/rate) para TODOS os 12 arquétipos padrão.
 *  - Auto-assign de vozes PT-BR/PT-PT por preferência.
 *  - UI simples no Brain para escolher o arquétipo secundário.
 *
 * Compatível com hub_appcfg.consolidado.js (não requer edição nele).
 */
(function(){
  const LS = window.LS || {
    get:(k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d }catch(e){ return d } },
    set:(k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)) }catch(e){} },
    raw:(k)=> localStorage.getItem(k)||''
  };

  // 12 arquétipos canônicos (fallback aos apps embutidos quando disponíveis)
  function archKeys(){
    try{
      if (window.RAW && Array.isArray(RAW.apps)) {
        const list = RAW.apps.map(a => (a.key||'').toLowerCase()).filter(Boolean);
        if (list.length >= 8) return Array.from(new Set(list));
      }
    }catch(e){}
    return ['nova','atlas','vitalis','pulse','artemis','serena','kaos','genus','lumine','rhea','solus','aion'];
  }
  function cap(s){ s=String(s||''); return s? (s[0].toUpperCase()+s.slice(1).toLowerCase()) : s; }

  // Pitch/Rate e preferências de voz por arquétipo
  const DEFAULT_PARAMS = {
    Luxara:  { pitch:1.02, rate:1.00, prefs:['Luciana','Joana','lang:pt-BR','lang:pt-PT'] },
    Nova:    { pitch:1.10, rate:1.05, prefs:['Luciana','Joana','lang:pt-BR'] },
    Elysha:  { pitch:1.04, rate:0.98, prefs:['Joana','Luciana','lang:pt-PT','lang:pt-BR'] },
    Kaion:   { pitch:1.00, rate:1.00, prefs:['Felipe','Joaquim','lang:pt-BR','lang:pt-PT'] },
    Serena:  { pitch:1.05, rate:0.95, prefs:['Luciana','Joana','lang:pt-BR'] },
    Aion:    { pitch:1.00, rate:0.93, prefs:['Felipe','Luciana','lang:pt-BR'] },
    Velor:   { pitch:1.00, rate:1.00, prefs:['Felipe','Luciana','lang:pt-BR'] }, // opcional
    Naira:   { pitch:1.02, rate:0.98, prefs:['Luciana','lang:pt-BR'] },         // opcional
    Sylon:   { pitch:0.98, rate:1.00, prefs:['Felipe','lang:pt-BR'] },          // opcional
    Thenir:  { pitch:1.00, rate:0.98, prefs:['Luciana','lang:pt-BR'] },         // opcional
    Rhea:    { pitch:1.02, rate:0.98, prefs:['Luciana','lang:pt-BR'] },
    Lumine:  { pitch:1.06, rate:1.02, prefs:['Luciana','lang:pt-BR'] },
    Genus:   { pitch:1.00, rate:0.98, prefs:['Luciana','Felipe','lang:pt-BR'] },
    Kaos:    { pitch:1.03, rate:1.08, prefs:['Felipe','Luciana','lang:pt-BR'] },
    Atlas:   { pitch:0.95, rate:1.00, prefs:['Felipe','Joaquim','lang:pt-BR','lang:pt-PT'] },
    Solus:   { pitch:0.98, rate:0.97, prefs:['Felipe','lang:pt-BR'] },
    Vitalis: { pitch:1.00, rate:1.00, prefs:['Felipe','Luciana','lang:pt-BR'] },
    Pulse:   { pitch:1.00, rate:1.07, prefs:['Felipe','Luciana','lang:pt-BR'] },
    Horus:   { pitch:1.00, rate:0.92, prefs:['Felipe','Luciana','lang:pt-BR'] }
  };

  // Semeia archParams para TODOS os 12 principais (e alguns extras)
  function seedArchParams(){
    const params = LS.get('infodose:archParams', {}) || {};
    const keys = new Set([
      ...Object.keys(DEFAULT_PARAMS),
      ...archKeys().map(k => cap(k))
    ]);
    keys.forEach(name => {
      if(!params[name]){
        const d = DEFAULT_PARAMS[name] || { pitch:1.0, rate:1.0 };
        params[name] = { pitch:d.pitch, rate:d.rate };
      }
    });
    LS.set('infodose:archParams', params);
  }

  // Carrega vozes (com polling p/ Safari)
  function loadVoices(timeoutMs=2000){
    return new Promise(res=>{
      let t=0;
      (function tick(){
        const list = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
        if(list && list.length) return res(list);
        if(++t*100>=timeoutMs) return res(list||[]);
        setTimeout(tick,100);
      })();
    });
  }

  function pickBestVoice(name, voices){
    const info = DEFAULT_PARAMS[name] || {};
    const prefs = info.prefs || [];
    const scored = voices.map(v => {
      const nm = (v.name||'').toLowerCase();
      const lg = (v.lang||'').toLowerCase();
      let s = 0;
      if(lg.startsWith('pt-br')) s += 4;
      if(lg.startsWith('pt-pt')) s += 3;
      prefs.forEach((p,idx)=>{
        if(p.startsWith('lang:')){
          if(lg === p.split(':')[1].toLowerCase()) s += 10-idx;
        } else if(nm.includes(p.toLowerCase())) s += 12-idx;
      });
      if(v.localService) s += 1;
      return {v, s};
    }).sort((a,b)=>b.s-a.s);
    const best = scored[0] && scored[0].s>0 ? scored[0].v : null;
    return best || voices.find(v => /^pt/i.test(v.lang)) || voices[0] || null;
  }

  async function ensureVoiceMapping(){
    const mapping = LS.get('infodose:voices', {}) || {};
    const voices  = await loadVoices();
    const keys = new Set([
      ...Object.keys(DEFAULT_PARAMS),
      ...archKeys().map(k => cap(k))
    ]);
    keys.forEach(name=>{
      if(!mapping[name]){
        const best = pickBestVoice(name, voices);
        if(best) mapping[name] = best.name;
      }
    });
    LS.set('infodose:voices', mapping);
  }

  // UI: seletor de arquétipo secundário no Brain
  function ensureArchB_UI(){
    try{
      const brainGrid = document.querySelector('#v-brain .grid');
      if(!brainGrid) return;
      if(document.getElementById('archBCard')) return;
      const card = document.createElement('div');
      card.className = 'card fx-trans fx-lift';
      card.id = 'archBCard';
      const current = localStorage.getItem('uno:archB') || '';
      const opts = archKeys().map(k => {
        const name = cap(k);
        const sel  = (current && current.toLowerCase()===k) ? ' selected' : '';
        return `<option value="${k}"${sel}>${name}</option>`;
      }).join('');
      card.innerHTML = `
        <div style="font-weight:800">Arquétipo Secundário</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
          <select id="archBSelect" class="input ring" style="min-width:180px">${opts}</select>
          <button id="saveArchB" class="btn prime fx-trans fx-press ring">Salvar<span class="ripple"></span></button>
        </div>
        <div class="mut" style="font-size:11px;margin-top:6px">Define o segundo arquétipo usado no prompt do sistema (Role: system).</div>`;
      // Insere após o card de "Nome do Dual" se existir, senão no fim
      const dualNameCard = document.getElementById('dualName')?.closest('.card');
      if(dualNameCard && dualNameCard.nextSibling){
        brainGrid.insertBefore(card, dualNameCard.nextSibling);
      }else{
        brainGrid.appendChild(card);
      }
      const btn = card.querySelector('#saveArchB');
      btn.addEventListener('click', ()=>{
        const sel = card.querySelector('#archBSelect');
        const val = (sel && sel.value) || '';
        if(val) localStorage.setItem('uno:archB', val);
        try{ window.toast && toast('Arquétipo secundário salvo','ok'); }catch(e){}
      });
    }catch(e){}
  }

  // Patch de PowerAI.chat: usa arquétipo secundário real (uno:archB), e não o nome do Dual.
  (function patchPowerAI(){
    const getUserName = window.getUserName || (()=> (localStorage.getItem('infodose:userName')||'').trim());
    const getModel    = window.getModel    || ( ()=> (localStorage.getItem('dual.openrouter.model')||'openrouter/auto') );
    const getApiKey   = window.getApiKey   || ( ()=> (localStorage.getItem('dual.keys.openrouter')||'').trim() );
    const dualFetch   = window.dualFetch   || (url,options)=> fetch(url, options);
    const getArchDesc = window.getArchDesc || (k=> '');

    async function loadDXTTrainingText(){
      try{
        const raw = localStorage.getItem('dual.openrouter.training');
        if(!raw) return '';
        const obj = JSON.parse(raw);
        if(!obj?.data) return '';
        const base64 = String(obj.data).split(',')[1] || '';
        if(!base64) return '';
        const bytes = atob(base64);
        return bytes.length > 64*1024 ? bytes.slice(0, 64*1024) : bytes;
      }catch{ return ''; }
    }

    function currentPrimary(){
      try{
        const sel = document.getElementById('arch-select');
        if(sel?.value) return cap(sel.value.replace(/\.html$/,''));
      }catch(e){}
      // fallback: primeiro app
      const list = archKeys();
      return cap(list[0]||'Dual');
    }
    function currentSecondary(){
      const val = (localStorage.getItem('uno:archB')||'').toLowerCase();
      if(!val) return '';
      const list = archKeys();
      return list.includes(val) ? cap(val) : '';
    }

    const old = window.PowerAI && window.PowerAI.chat;
    window.PowerAI = window.PowerAI || {};
    window.PowerAI.chat = async function(userContent, sk, model, opts={}){
      const archA = currentPrimary();
      const archB = currentSecondary();
      const dualName = (localStorage.getItem('dual.infodoseName')||'').trim() || 'Dual Infodose';
      const userName = getUserName();
      const descA = getArchDesc(archA.toLowerCase());
      let sys = `Você é ${dualName}.` +
                `\nArquétipo primário: ${archA}${descA ? ' – ' + descA : ''}.`;
      if(archB) sys += `\nArquétipo secundário: ${archB}.`;
      sys += `\nFale sempre em português do Brasil, direto e gentil.` +
             `\nUse o contexto do app (UNO • Brain • Stack • Apps) quando útil.`;
      if(userName) sys += `\nO interlocutor se chama ${userName}.`;

      let training = await loadDXTTrainingText();
      if(training && training.trim().startsWith('{')){
        try{
          const j = JSON.parse(training);
          training = (j.system || j.prompt || JSON.stringify(j));
        }catch{}
      }
      if(training) sys += `\n\n# Treinamento DXT\n${training}`;

      const payload = {
        model: (model && String(model).trim()) || getModel(),
        messages: [
          { role: 'system', content: sys },
          { role: 'user',   content: String(userContent||'') }
        ],
        max_tokens: 350,
        temperature: 0.7
      };
      const key = (sk && String(sk).trim()) || getApiKey();
      if(!key) throw new Error('Chave OpenRouter ausente — salve em Brain.');

      const res = await dualFetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': location.origin,
          'X-Title': 'Dual • UNO'
        },
        body: JSON.stringify(payload)
      }, 20000);
      if(!res.ok){
        const txt = await res.text().catch(()=> '');
        throw new Error(`Erro na API: ${res.status} ${txt&&'- '+txt.slice(0,180)}`);
      }
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || '';
    };

    // Mantém compat com sendAIMessage legado
    const oldSend = window.sendAIMessage;
    window.sendAIMessage = async function(content, sk, model, opts={}){
      return await window.PowerAI.chat(content, sk, model, opts);
    };
  })();

  // Rodar após DOM
  document.addEventListener('DOMContentLoaded', ()=>{
    try{ seedArchParams(); }catch(e){}
    try{ ensureVoiceMapping(); }catch(e){}
    try{ ensureArchB_UI(); }catch(e){}
  });
})();
