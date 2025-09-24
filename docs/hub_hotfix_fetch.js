// === Hotfix: identidade, treinamento e arquétipo (UNO) ===
(function(){
  const K = {
    name:  'infodose:userName',
    sk:    'dual.keys.openrouter',
    model: 'dual.openrouter.model',
    train: 'dual.openrouter.training'
  };

  // 1) Migrar chaves antigas → canônicas (inclui treinamento)
  [
    ['dual.name', K.name],
    ['infodose:name', K.name],
    ['infodose:sk', K.sk],
    ['infodose:model', K.model],
    // treinos antigos que possam ter sido usados
    ['infodose:training', K.train],
    ['openai:system', K.train]
  ].forEach(([oldKey, newKey])=>{
    try{
      const v = localStorage.getItem(oldKey);
      if(v && !localStorage.getItem(newKey)) localStorage.setItem(newKey, v);
    }catch(e){}
  });

  // 2) Carregar treino (DataURL/JSON/TXT) e garantir UTF‑8
  async function loadTraining(){
    try{
      const raw = localStorage.getItem(K.train);
      if(!raw) return '';
      let obj; try{ obj = JSON.parse(raw); }catch{ obj = raw; }
      const dataUrl = (obj && obj.data) ? obj.data : String(obj||'');
      const base64  = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const bytes   = atob(base64);
      const buf     = new Uint8Array(bytes.length);
      for (let i=0;i<bytes.length;i++) buf[i] = bytes.charCodeAt(i);
      const txt = new TextDecoder('utf-8', { fatal:false }).decode(buf);
      // Se for JSON com campo system/prompt, usar preferencialmente
      try{
        const j = JSON.parse(txt);
        return String(j.system || j.prompt || txt);
      }catch{}
      return txt;
    }catch{ return ''; }
  }

  function cap(s){ return (s||'').charAt(0).toUpperCase()+String(s||'').slice(1).toLowerCase(); }
  function currentArch(){
    try{
      const sel = document.getElementById('arch-select');
      if(sel?.value) return sel.value.replace(/\.html$/i,'').toLowerCase();
    }catch{}
    return 'dual';
  }

  // 3) Um único sendAIMessage com identidade completa (substitui anteriores)
  window.sendAIMessage = async function(userContent, sk, model){
    const name = (localStorage.getItem(K.name)||'').trim();
    const key  = (sk && String(sk).trim()) || (localStorage.getItem(K.sk)||'').trim();
    const mdl  = (model && String(model).trim())
                 || (window.LS?.get?.(K.model) || localStorage.getItem(K.model) || 'openrouter/auto');
    if(!key) throw new Error('Chave OpenRouter ausente — salve no Brain.');

    const arch = cap(currentArch());
    const dualName = (localStorage.getItem('dual.infodoseName')||'').trim();
    const codename = dualName ? `${dualName} Dual Infodose` : 'Dual Infodose';

    const desc = (typeof getArchDesc==='function' ? getArchDesc(arch.toLowerCase()) : '') || '';
    const training = await loadTraining();

    const sys =
`Você é o Assistente Dual Infodose — codinome "${codename}".
Arquétipo primário: ${arch}${desc ? ' – ' + desc : ''}.
Considere-se conectado aos arquétipos ${arch} e ${codename}.
${name ? `Você conversa com ${name}.` : ''}
Fale sempre em português do Brasil, direto e gentil.`
      + (training ? `

# Treinamento DXT
${training}` : '');

    const payload = {
      model: mdl,
      messages: [
        { role: 'system', content: sys },
        { role: 'user',   content: String(userContent||'') }
      ],
      max_tokens: 350,
      temperature: 0.7
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': location.origin,
        'X-Title': 'Dual • UNO'
      },
      body: JSON.stringify(payload)
    });
    if(!res.ok){
      const t = await res.text().catch(()=> '');
      throw new Error(`Erro na API: ${res.status} ${t && ('- ' + t.slice(0,180))}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  };

  // 4) Enviar só o texto do usuário (sem “{nome} disse:”)
  const oldHandle = window.handleUserMessage;
  window.handleUserMessage = async function(text, userName, sk, model){
    let reply = '';
    try{
      reply = await window.sendAIMessage(text, sk, model);
    }catch(err){
      console.error('Falha ao consultar IA:', err);
      reply = 'Desculpe, não consegui responder no momento.';
    }
    if(reply){
      let archName = 'Dual';
      try{
        const select = document.getElementById('arch-select');
        const base = (select?.value || '').replace(/\.html$/i,'');
        archName = cap(base);
      }catch(e){}
      feedPush('ai', archName + ': ' + reply);
      showArchMessage(reply, 'ok');
      try{ speakWithActiveArch(reply); }catch{}
    }
  };
})();