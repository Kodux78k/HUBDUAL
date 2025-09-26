
// ===== Dual Multi‑Agent Plug-in — v1 (Horus → Atlas/Ion) =====
// Lightweight orchestrator that detects calls to Horus and runs a
// 3‑step flow: (1) Horus planeja → (2) Atlas/Ion executam → (3) Horus consolida.
// It plugs into the existing UNO/ChatPlus app without breaking anything.
//
// Requirements: OpenRouter key + model saved in Brain (already supported by the app).
// Triggers: messages that mention "Horus" (ex.: "Oi, Horus Dual…") or start with "@horus".

(function(){
  const $ = (q, r=document)=>r.querySelector(q);
  const $$ = (q, r=document)=>Array.from(r.querySelectorAll(q));
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
    raw:(k)=>localStorage.getItem(k)||''
  };

  // ---- CSS (actors bubbles) ----
  const CSS = `
  #chatFeed .msg.horus{align-self:flex-start;background:rgba(255,195,0,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.atlas{align-self:flex-start;background:rgba(64,158,255,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.ion{align-self:flex-start;background:rgba(255,159,67,.16);border-radius:16px 16px 16px 0;padding:8px 12px;max-width:75%}
  #chatFeed .msg.status{align-self:center;color:var(--mut);background:transparent}
  .ai-tag{font-weight:900;letter-spacing:.02em;margin:0 0 4px 0;opacity:.9}
  .ai-meta{font-size:12px;color:var(--mut)}
  .plan-list{margin:6px 0 0 0;padding-left:18px}
  .plan-list li{margin:4px 0}
  `;
  (function(){ try { if (!document.getElementById('multiagent-styles')) { const s = document.createElement('style'); s.id='multiagent-styles'; s.textContent = CSS; document.head.appendChild(s); } } catch(e){} })();

  // ---- Helpers ----
  function actorLabel(a){ return a==='horus'?'Horus Dual':(a==='atlas'?'Atlas Dual InfoDose':(a==='ion'?'Ion Dual InfoDose':'IA')); }
  function getUserName(){ return (localStorage.getItem('dual.name')||localStorage.getItem('infodose:userName')||'Dual').trim(); }
  function getKey(){ return (localStorage.getItem('dual.keys.openrouter')||localStorage.getItem('infodose:sk')||'').trim(); }
  function getModel(){
    let m = LS.get('dual.openrouter.model');
    if (!m) m = (localStorage.getItem('infodose:model')||'').trim();
    return m || 'openrouter/auto';
  }
  function updatePreviewSafe(t){ try{ if (typeof updatePreview==='function') updatePreview(String(t||'').slice(0,200)); }catch{} }
  function speak(t){ try{ if (typeof speakWithActiveArch==='function') speakWithActiveArch(t); }catch{} }
  function showMsg(t, kind){ try{ if (typeof showArchMessage==='function') showArchMessage(t, kind||'info'); }catch{} }
  function pushStatus(t){ try{ if (typeof feedPush==='function') feedPush('status', t); }catch{} }

  function agentPush(actor, text, nodeBuilder){
    const feed = document.getElementById('chatFeed'); if (!feed) return;
    const wrap = document.createElement('div'); wrap.className = 'msg ' + (actor||'ai');
    const who = document.createElement('div'); who.className = 'ai-tag'; who.textContent = actorLabel(actor);
    const body = document.createElement('div'); body.className = 'ai-body';
    // Plain text in <p> to avoid untrusted HTML
    const p = document.createElement('p'); p.textContent = text; body.appendChild(p);
    // Optional extra nodes (e.g., tasks list)
    if (typeof nodeBuilder === 'function') {
      try { const node = nodeBuilder(); if (node) body.appendChild(node); } catch{}
    }
    wrap.appendChild(who); wrap.appendChild(body);
    feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
    // Persist to ChatStore as assistant message (prefix with actor)
    try {
      if (window.ChatStore && typeof ChatStore.append==='function') {
        ChatStore.append('assistant', actorLabel(actor) + ': ' + text);
      }
    } catch{}
    updatePreviewSafe(text);
    speak(text);
    return wrap;
  }

  // JSON coercion for LLM outputs
  function coerceJSON(s){
    if (!s) return null;
    // Direct parse
    try { return JSON.parse(s); } catch{}
    // From fenced block
    const m = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(s);
    if (m) { try { return JSON.parse(m[1]); } catch{} }
    // From first { .. last }
    const i = s.indexOf('{'); const j = s.lastIndexOf('}');
    if (i>=0 && j>i){ try { return JSON.parse(s.slice(i, j+1)); } catch{} }
    return null;
  }

  // OpenRouter call (raw messages)
  async function callOpenRouter(messages, { model, sk, max_tokens=800, temperature=0.6 }={}){
    model = model || getModel(); sk = sk || getKey();
    if (!sk) throw new Error('Chave OpenRouter ausente.');
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sk}` },
      body: JSON.stringify({ model, messages, max_tokens, temperature })
    });
    if (!res.ok) throw new Error('OpenRouter HTTP ' + res.status);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return content;
  }

  // ---- Systems / Schemas ----
  const HORUS_PLAN_SYSTEM = [
    'Você é **Horus Dual**, orquestrador.',
    'TAREFA: entender o pedido do usuário, decidir quais arquétipos ativar (atlas, ion) e gerar um PLANO em JSON.',
    'Responda APENAS JSON VÁLIDO (sem Markdown, sem comentários) com este formato exato:',
    '{',
    ' "plano": "resumo curto",',
    ' "ativacoes": ["atlas","ion"],',
    ' "tarefas": [',
    '   {"id":"T1","agente":"atlas","objetivo":"...","entradas":["..."],"entregavel":"..."},',
    '   {"id":"T2","agente":"ion","objetivo":"...","entradas":["..."],"entregavel":"..."}',
    ' ],',
    ' "perguntas_ao_usuario": []',
    '}',
    'Regras:',
    ' - agente ∈ {"atlas","ion"}',
    ' - texto em pt-BR',
    ' - NUNCA saia do JSON.'
  ].join('\n');

  const REPLY_HINT = '{ "tarefaId":"T1","posso_fazer":true,"plano_execucao":"passos breves","eta_texto":"~2 horas","resultado_preliminar":"…","artefatos":[] }';

  const ATLAS_SYSTEM = [
    'Você é **Atlas Dual InfoDose** (pesquisa/síntese).',
    'Entregue resumos objetivos, quadros e referências quando útil.',
    'Responda APENAS JSON com o formato:',
    REPLY_HINT,
    'Idioma: pt-BR. Sem Markdown.'
  ].join('\n');

  const ION_SYSTEM = [
    'Você é **Ion Dual InfoDose** (análise técnica, riscos e recomendações).',
    'Explique suposições e dê checklist.',
    'Responda APENAS JSON com o formato:',
    REPLY_HINT,
    'Idioma: pt-BR. Sem Markdown.'
  ].join('\n');

  const HORUS_CONSOLIDATE_SYSTEM = [
    'Você é **Horus Dual**, orquestrador.',
    'Com base no PLANO e nas RESPOSTAS dos agentes, produza a entrega FINAL como TEXTO em pt-BR',
    'estruturada exatamente nestes três blocos (títulos obrigatórios):',
    '### Recompensa Inicial',
    '### Curiosidade & Expansão',
    '### Antecipação Vibracional',
    'Inclua próximos passos, donos e riscos quando fizer sentido.',
    'Se houver lacunas, assuma hipóteses realistas.'
  ].join('\n');

  // ---- UI helpers ----
  function renderTaskList(tarefas){
    const ul = document.createElement('ul'); ul.className = 'plan-list';
    (tarefas||[]).forEach(t => {
      const li = document.createElement('li');
      li.textContent = `${t.id || '-'} · ${t.agente?.toUpperCase()||'?'} → ${t.objetivo || ''}`;
      ul.appendChild(li);
    });
    return ul;
  }

  // ---- Multi-agent orchestration ----
  function shouldMulti(s){
    if (!s) return false;
    const t = s.toLowerCase();
    return /^@\s*horus\b/.test(t) || /\bhorus\b/.test(t);
  }

  async function runMultiAgentFlow(userText){
    const name = getUserName();
    const sk = getKey(); const model = getModel();
    if (!sk) {
      showMsg('Configure nome, chave e modelo no Brain para conversar.', 'warn');
      if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText);
      return;
    }
    pushStatus('🧭 Horus analisando pedido…');
    let planRaw = '';
    try {
      planRaw = await callOpenRouter([
        { role:'system', content: HORUS_PLAN_SYSTEM },
        { role:'user', content: `Usuário: ${name}\nPedido: ${userText}` }
      ], { model, sk, max_tokens: 800, temperature: 0.4 });
    } catch (e) {
      pushStatus('⚠️ Falha ao planejar com Horus.');
      if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText);
      return;
    }
    const plan = coerceJSON(planRaw);
    if (!plan || !Array.isArray(plan.tarefas) || plan.tarefas.length===0) {
      pushStatus('⚠️ Plano inválido. Seguindo resposta única.');
      if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText);
      return;
    }
    const ativ = Array.isArray(plan.ativacoes)&&plan.ativacoes.length ? plan.ativacoes : Array.from(new Set((plan.tarefas||[]).map(t=>t.agente))).filter(Boolean);
    agentPush('horus', `Perfeito, ${name}. Para elaborar seu plano vou ativar ${ativ.map(a=>a[0].toUpperCase()+a.slice(1)).join(' e ')}.`, ()=>renderTaskList(plan.tarefas));

    // 2) Run Atlas/Ion in parallel
    pushStatus('🧪 Atlas/Ion executando tarefas…');
    const calls = (plan.tarefas||[]).map(t => {
      const actor = (String(t.agente||'').toLowerCase()==='ion') ? 'ion' : 'atlas';
      const sys = actor==='ion' ? ION_SYSTEM : ATLAS_SYSTEM;
      const u = [
        `Tarefa ${t.id||''}: ${t.objetivo||''}`,
        `Entradas: ${JSON.stringify(t.entradas||[])}`,
        `Entregável: ${t.entregavel || 'Texto estruturado.'}`
      ].join('\n');
      return callOpenRouter([ {role:'system', content: sys}, {role:'user', content: u} ], { model, sk, max_tokens: 700, temperature: 0.6 })
        .then(raw => ({ actor, raw, t }))
        .catch(err => ({ actor, error: String(err), t }));
    });

    const results = await Promise.all(calls);
    const replies = [];
    for (const r of results){
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

    // 3) Consolidation
    pushStatus('🧩 Horus consolidando…');
    let finalText = '';
    try {
      finalText = await callOpenRouter([
        { role:'system', content: HORUS_CONSOLIDATE_SYSTEM },
        { role:'user', content: `Pedido original: ${userText}` },
        { role:'assistant', content: `PLANO:\n${JSON.stringify(plan)}` },
        { role:'assistant', content: `RESPOSTAS:\n${JSON.stringify(replies)}` }
      ], { model, sk, max_tokens: 900, temperature: 0.5 });
    } catch(e){
      finalText = 'Consolidação indisponível no momento.';
    }
    if (typeof window.renderAssistantReply==='function') {
      window.renderAssistantReply(finalText);
    } else {
      agentPush('horus', finalText);
    }
  }

  // ---- Hook into sendUserMessage ----
  if (typeof window.sendUserMessage === 'function') {
    window.__sendUserMessageSingle = window.sendUserMessage;
    window.sendUserMessage = function(message){
      const msg = String(message||'').trim();
      if (shouldMulti(msg)) return runMultiAgentFlow(msg);
      return window.__sendUserMessageSingle(msg);
    };
  }

})(); // end IIFE
