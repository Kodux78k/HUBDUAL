
// ===== Dual Multi‑Agent Plug‑in — v12 (Horus → 12 arquétipos) =====
// Orquestração: Horus planeja → (Atlas, Nova, Vitalis, Pulse, Artemis, Serena,
// Kaos, Genus, Lumine, Rhea, Solus, Aion/Ion) executam em paralelo → Horus consolida.
// Integra-se ao ChatPlus/UNO mantendo API e visual.

(function(){
  const $ = (q, r=document)=>r.querySelector(q);
  const $$ = (q, r=document)=>Array.from(r.querySelectorAll(q));
  const LS = {
    get:(k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d }catch{ return d } },
    set:(k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)) }catch{} },
    raw:(k)=>localStorage.getItem(k)||''
  };

  // ---------- CSS (bolhas por agente) ----------
  const CSS = `
  #chatFeed .msg.horus{align-self:flex-start;background:rgba(255,195,0,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.atlas{align-self:flex-start;background:rgba(64,158,255,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.nova{align-self:flex-start;background:rgba(255,82,177,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.vitalis{align-self:flex-start;background:rgba(87,207,112,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.pulse{align-self:flex-start;background:rgba(186,130,219,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.artemis{align-self:flex-start;background:rgba(0,209,178,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.serena{align-self:flex-start;background:rgba(255,184,107,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.kaos{align-self:flex-start;background:rgba(255,77,109,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.genus{align-self:flex-start;background:rgba(87,207,112,.12);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.lumine{align-self:flex-start;background:rgba(255,213,79,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.rhea{align-self:flex-start;background:rgba(0,191,255,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.solus{align-self:flex-start;background:rgba(155,109,219,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.aion{align-self:flex-start;background:rgba(255,159,67,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.status{align-self:center;color:var(--mut);background:transparent}
  .ai-tag{font-weight:900;letter-spacing:.02em;margin:0 0 4px 0;opacity:.9}
  .ai-meta{font-size:12px;color:var(--mut)}
  .plan-list{margin:6px 0 0 0;padding-left:18px}
  .plan-list li{margin:4px 0}
  `;
  (function injectCSS(){
    if (!document.getElementById('multiagent12-styles')){
      const s=document.createElement('style'); s.id='multiagent12-styles'; s.textContent = CSS; document.head.appendChild(s);
    }
  })();

  // ---------- Helpers ----------
  function actorLabel(a){
    const map = {
      horus:'Horus Dual',
      atlas:'Atlas',
      nova:'Nova',
      vitalis:'Vitalis',
      pulse:'Pulse',
      artemis:'Artemis',
      serena:'Serena',
      kaos:'Kaos',
      genus:'Genus',
      lumine:'Lumine',
      rhea:'Rhea',
      solus:'Solus',
      aion:'Aion (Ion)',
      ion:'Aion (Ion)'
    };
    return map[a] || a;
  }
  function getUserName(){ return (localStorage.getItem('dual.name')||localStorage.getItem('infodose:userName')||'Dual').trim(); }
  function getKey(){ return (localStorage.getItem('dual.keys.openrouter')||localStorage.getItem('infodose:sk')||'').trim(); }
  function getModel(){
    let m = LS.get('dual.openrouter.model');
    if (!m) m = (localStorage.getItem('infodose:model')||'').trim();
    return m || 'openrouter/auto';
  }
  function updatePreviewSafe(t){ try{ if (typeof updatePreview==='function') updatePreview(String(t||'').slice(0,200)); }catch{} }
  function speak(t){ try{ if (typeof speakWithActiveArch==='function') speakWithActiveArch(t); }catch{} }
  function pushStatus(t){ try{ if (typeof feedPush==='function') feedPush('status', t); }catch{} }

  function agentPush(actor, text, nodeBuilder){
    const feed = document.getElementById('chatFeed'); if (!feed) return;
    const wrap = document.createElement('div'); wrap.className = 'msg ' + (actor||'ai');
    const who = document.createElement('div'); who.className = 'ai-tag'; who.textContent = actorLabel(actor);
    const body = document.createElement('div'); body.className = 'ai-body';
    const p = document.createElement('p'); p.textContent = text; body.appendChild(p);
    if (typeof nodeBuilder === 'function') { try { const node = nodeBuilder(); if (node) body.appendChild(node); } catch{} }
    wrap.appendChild(who); wrap.appendChild(body);
    feed.appendChild(wrap); feed.scrollTop = feed.scrollHeight;
    try { if (window.ChatStore && typeof ChatStore.append==='function') { ChatStore.append('assistant', actorLabel(actor)+': '+text); } } catch{}
    updatePreviewSafe(text); speak(text);
    return wrap;
  }

  // ---------- JSON coercion ----------
  function coerceJSON(s){
    if (!s) return null;
    try { return JSON.parse(s); } catch{}
    const m = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(s);
    if (m) { try { return JSON.parse(m[1]); } catch{} }
    const i = s.indexOf('{'); const j = s.lastIndexOf('}');
    if (i>=0 && j>i){ try { return JSON.parse(s.slice(i, j+1)); } catch{} }
    return null;
  }

  // ---------- API call ----------
  async function callOpenRouter(messages, { model, sk, max_tokens=800, temperature=0.6 }={}){
    model = model || getModel(); sk = sk || getKey();
    if (!sk) throw new Error('Chave OpenRouter ausente.');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${sk}` },
      body:JSON.stringify({ model, messages, max_tokens, temperature })
    });
    if (!res.ok) throw new Error('OpenRouter HTTP '+res.status);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return content;
  }

  // ---------- Schemas / Systems ----------
  const REPLY_HINT = '{ "tarefaId":"T1","posso_fazer":true,"plano_execucao":"passos breves","eta_texto":"~2 horas","resultado_preliminar":"…","artefatos":[] }';

  const HORUS_PLAN_SYSTEM = [
    'Você é **Horus Dual**, orquestrador.',
    '1) Entenda o pedido. 2) Decida quais arquétipos ativar dentre:',
    '   atlas, nova, vitalis, pulse, artemis, serena, kaos, genus, lumine, rhea, solus, aion (alias: ion).',
    '3) Quebre em tarefas claras por arquétipo. 4) Se a mensagem disser "todos", "os doze" ou "12", ative TODOS.',
    'Responda APENAS JSON válido no formato:',
    '{ "plano":"resumo curto", "ativacoes":["atlas","nova",...], "tarefas":[{"id":"T1","agente":"atlas","objetivo":"...","entradas":["..."],"entregavel":"..."}], "perguntas_ao_usuario":[] }',
    'Regras: agente ∈ {"atlas","nova","vitalis","pulse","artemis","serena","kaos","genus","lumine","rhea","solus","aion"}; texto pt-BR; nunca saia do JSON.'
  ].join('\n');

  const HORUS_CONSOLIDATE_SYSTEM = [
    'Você é **Horus Dual**, orquestrador.',
    'Com base no PLANO e nas RESPOSTAS dos agentes, produza a entrega FINAL como TEXTO em pt-BR,',
    'estruturada nestes três blocos (títulos exatos):',
    '### Recompensa Inicial',
    '### Curiosidade & Expansão',
    '### Antecipação Vibracional',
    'Inclua próximos passos, donos e riscos quando fizer sentido.'
  ].join('\n');

  // Registro de agentes (12)
  const AGENTS = {
    atlas:   { sys: ['Você é **Atlas** (planejamento estratégico).','Crie cronogramas/checklists e marcos objetivos.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    nova:    { sys: ['Você é **Nova** (ideação criativa).','Gere ideias, mapas mentais em texto e exercícios de desbloqueio.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    vitalis: { sys: ['Você é **Vitalis** (energia/rotinas/biologia).','Proponha rituais, hábitos e micro-hábitos seguros.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    pulse:   { sys: ['Você é **Pulse** (trilhas sonoras/modulação emocional).','Sugira playlists/sons e como usar no fluxo de trabalho.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    artemis: { sys: ['Você é **Artemis** (pesquisa/rotas de aprendizado).','Faça RAG leve, fontes/rotas e plano de estudo.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    serena:  { sys: ['Você é **Serena** (acolhimento/comunicação empática).','Traga enquadre, validação e práticas de autocuidado.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    kaos:    { sys: ['Você é **Kaos** (disrupção/questionamento).','Desafie suposições, proponha caminhos ousados e planos B.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    genus:   { sys: ['Você é **Genus** (protótipos/entregáveis).','Descreva artefatos, wireframes e rascunhos implementáveis.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    lumine:  { sys: ['Você é **Lumine** (leveza/lúdico).','Sugira atividades de aquecimento criativo e gamificação.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    rhea:    { sys: ['Você é **Rhea** (story/memórias/tribo).','Conecte proposta com narrativa e comunidade.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    solus:   { sys: ['Você é **Solus** (harmonização/meditação).','Proponha respiração, rituais, e pausas estruturadas.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') },
    aion:    { sys: ['Você é **Aion/Ion** (microações/cadência).','Transforme objetivos em passos mínimos com cadência.','Responda APENAS JSON:', REPLY_HINT,'pt-BR. Sem Markdown.'].join('\n') }
  };

  const ALL_AGENT_KEYS = Object.keys(AGENTS); // 12

  // ---------- UI helpers ----------
  function renderTaskList(tarefas){
    const ul = document.createElement('ul'); ul.className = 'plan-list';
    (tarefas||[]).forEach(t => {
      const li = document.createElement('li');
      li.textContent = `${t.id || '-'} · ${String(t.agente||'').toUpperCase()} → ${t.objetivo || ''}`;
      ul.appendChild(li);
    });
    return ul;
  }

  // ---------- Flow Trigger ----------
  function shouldMulti(s){
    if (!s) return false;
    const t = s.toLowerCase();
    return /^@\s*horus\b/.test(t) || /\bhorus\b/.test(t);
  }
  function wantsAll(t){
    const s = (t||'').toLowerCase();
    return /\bos\s*doze\b|\btodos\b|\b12\b/.test(s);
  }

  // ---------- Multi-agent Orchestration ----------
  async function runMultiAgentFlow(userText){
    const name = getUserName();
    const sk = getKey(); const model = getModel();
    if (!sk) {
      try { if (typeof showArchMessage==='function') showArchMessage('Configure nome, chave e modelo no Brain para conversar.', 'warn'); } catch{}
      if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText);
      return;
    }
    pushStatus('🧭 Horus analisando pedido…');
    // 1) Plan
    let planRaw = '';
    try {
      const hints = wantsAll(userText) ? '\nNota: o usuário pediu TODOS os 12 arquétipos.' : '';
      planRaw = await callOpenRouter([
        { role:'system', content: HORUS_PLAN_SYSTEM },
        { role:'user', content: `Usuário: ${name}\nPedido: ${userText}${hints}` }
      ], { model, sk, max_tokens: 900, temperature: 0.4 });
    } catch (e) {
      pushStatus('⚠️ Falha ao planejar com Horus.');
      if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText);
      return;
    }
    const plan = coerceJSON(planRaw);
    if (!plan) {
      pushStatus('⚠️ Plano inválido. Seguindo resposta única.');
      if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText);
      return;
    }
    let ativ = Array.isArray(plan.ativacoes) ? plan.ativacoes.map(a=>String(a||'').toLowerCase()) : [];
    // Expand 'ion' to 'aion'; normalize
    ativ = ativ.map(a => (a==='ion' ? 'aion' : a));
    // If user asked all 12 → force all
    if (wantsAll(userText)) ativ = [...ALL_AGENT_KEYS];
    // If empty → infer from tasks; and still, if <2, keep as is
    if (!ativ.length && Array.isArray(plan.tarefas)) {
      ativ = Array.from(new Set(plan.tarefas.map(t => String(t.agente||'').toLowerCase()).map(a=>a==='ion'?'aion':a))).filter(Boolean);
    }
    // Ensure only known agents
    ativ = ativ.filter(a => ALL_AGENT_KEYS.includes(a));
    // If tasks missing for some activated agents, create shell tasks
    const tarefas = Array.isArray(plan.tarefas) ? plan.tarefas.slice() : [];
    const hasTaskFor = new Set(tarefas.map(t => (String(t.agente||'').toLowerCase()==='ion'?'aion':String(t.agente||'').toLowerCase())));
    ativ.forEach(key => {
      if (!hasTaskFor.has(key)) {
        tarefas.push({ id: 'T_'+key.toUpperCase(), agente:key, objetivo:`Contribuir com perspectiva ${actorLabel(key)} ao pedido`, entradas:[], entregavel:'Resumo estruturado' });
      }
    });
    // Horus → UI
    agentPush('horus', `Perfeito, ${name}. Para elaborar seu plano, vou ativar ${ativ.map(a=>actorLabel(a)).join(', ')}.`, ()=>renderTaskList(tarefas));

    // 2) Execução paralela (12)
    pushStatus('🧪 Arquétipos executando tarefas…');
    const calls = tarefas.map(t => {
      let key = String(t.agente||'').toLowerCase();
      if (key === 'ion') key = 'aion';
      // Skip unknown keys defensively
      if (!AGENTS[key]) return Promise.resolve({ actor:key, error:'Agente desconhecido', t });
      const sys = AGENTS[key].sys;
      const user = [
        `Tarefa ${t.id||''}: ${t.objetivo||''}`,
        `Entradas: ${JSON.stringify(t.entradas||[])}`,
        `Entregável: ${t.entregavel || 'Texto estruturado.'}`
      ].join('\n');
      return callOpenRouter([ {role:'system', content: sys}, {role:'user', content: user} ], { model, sk, max_tokens: 700, temperature: 0.65 })
        .then(raw => ({ actor:key, raw, t }))
        .catch(err => ({ actor:key, error: String(err), t }));
    });

    const results = await Promise.all(calls);
    const replies = [];
    for (const r of results){
      if (!r) continue;
      if (r.error) {
        agentPush(r.actor, `Não consegui executar ${r.t?.id||''}.`, null);
        replies.push({ agente:r.actor, erro:r.error, tarefa:r.t });
        continue;
      }
      const j = coerceJSON(r.raw) || {};
      const resumo = j.resultado_preliminar || r.raw;
      const eta = j.eta_texto || 'em breve';
      const plano = j.plano_execucao ? (` ${j.plano_execucao}`) : '';
      agentPush(r.actor, `Consigo fazer ${r.t?.id||''}.${plano} Entrego ${eta}. Resumo: ${resumo}`);
      replies.push({ agente:r.actor, tarefaId: j.tarefaId||r.t?.id, reply:j });
    }

    // 3) Consolidação
    pushStatus('🧩 Horus consolidando…');
    let finalText = '';
    try {
      finalText = await callOpenRouter([
        { role:'system', content: HORUS_CONSOLIDATE_SYSTEM },
        { role:'user', content: `Pedido original: ${userText}` },
        { role:'assistant', content: `PLANO:\n${JSON.stringify({ ...plan, tarefas, ativacoes:ativ })}` },
        { role:'assistant', content: `RESPOSTAS:\n${JSON.stringify(replies)}` }
      ], { model, sk, max_tokens: 1100, temperature: 0.5 });
    } catch(e){
      finalText = 'Consolidação indisponível no momento.';
    }
    if (typeof window.renderAssistantReply==='function') {
      window.renderAssistantReply(finalText);
    } else {
      agentPush('horus', finalText);
    }
  }

  // ---------- Hook ----------
  if (typeof window.sendUserMessage === 'function') {
    window.__sendUserMessageSingle = window.sendUserMessage;
    window.sendUserMessage = function(message){
      const msg = String(message||'').trim();
      if (shouldMulti(msg)) return runMultiAgentFlow(msg);
      return window.__sendUserMessageSingle(msg);
    };
  }

})(); // end IIFE
