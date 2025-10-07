
// Dual Multi-Agent — v12.KOBLUX — Always-ON (override with @single)
// KOBLUX organiza e orquestra; HORUS valida o plano antes da execução.
// Modelo continua hard-locked; usa OpenRouter key do localStorage se existir.
// Se não houver key, cai para fluxo single-agent sem quebrar o app.
(function(){
  const MODEL_SLUG = "meta-llama/llama-3.1-8b-instruct:free";
  if (window.__MULTI_V12_KOBLUX__) return;
  window.__MULTI_V12_KOBLUX__ = true;

  const $ = (q,r=document)=>r.querySelector(q);
  const LS = { get:(k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d }catch{ return d } } };

  function actorLabel(a){
    const m={koblux:'KOBLUX',horus:'Horus Dual',atlas:'Atlas',nova:'Nova',vitalis:'Vitalis',pulse:'Pulse',artemis:'Artemis',serena:'Serena',kaos:'Kaos',genus:'Genus',lumine:'Lumine',rhea:'Rhea',solus:'Solus',aion:'Aion (Ion)',ion:'Aion (Ion)'};
    return m[a]||a;
  }
  function getUserName(){ return (localStorage.getItem('dual.name')||localStorage.getItem('infodose:userName')||'Dual').trim(); }
  function getKey(){ return (localStorage.getItem('dual.keys.openrouter')||localStorage.getItem('infodose:sk')||'').trim(); }
  function pushStatus(t){ try{ if(typeof feedPush==='function') feedPush('status', t) }catch{} }
  function agentPush(actor, text){
    const feed=document.getElementById('chatFeed'); if(!feed) return;
    const wrap=document.createElement('div'); wrap.className='msg '+(actor||'ai');
    const who=document.createElement('div'); who.style.fontWeight='900'; who.style.marginBottom='4px';
    who.textContent=actorLabel(actor);
    const p=document.createElement('div'); p.textContent=text;
    wrap.appendChild(who); wrap.appendChild(p);
    feed.appendChild(wrap); feed.scrollTop=feed.scrollHeight;
    try{ if(window.ChatStore && typeof ChatStore.append==='function') ChatStore.append('assistant', actorLabel(actor)+': '+text) }catch{}
  }
  function coerceJSON(s){
    if(!s) return null;
    try{ return JSON.parse(s) }catch{}
    const m=/```(?:json)?\s*([\s\S]*?)\s*```/i.exec(s); if(m){ try{ return JSON.parse(m[1]) }catch{} }
    const i=s.indexOf('{'), j=s.lastIndexOf('}'); if(i>=0 && j>i){ try{ return JSON.parse(s.slice(i,j+1)) }catch{} }
    return null;
  }
  async function callOpenRouter(messages, { max_tokens=800, temperature=0.6 }={}){
    const sk = getKey();
    if (!sk) throw new Error('Chave OpenRouter ausente.');
    const payload = { model: MODEL_SLUG, messages, max_tokens, temperature };
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${sk}` }, body:JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('OpenRouter HTTP '+res.status);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  const ALL = ["atlas","nova","vitalis","pulse","artemis","serena","kaos","genus","lumine","rhea","solus","aion"];
  const WANT_ALL_RE = /\bos\s*doze\b|\btodos\b|\b12\b/i;

  // Prompts
  const KOBLUX_PLAN = [
    'Você é **KOBLUX**, organizador e orquestrador tático.',
    'Entregue um JSON: { "plano":"...", "ativacoes":[...], "tarefas":[{id,agente,objetivo,entradas,entregavel}], "perguntas_ao_usuario":[] }',
    'Agentes válidos: atlas,nova,vitalis,pulse,artemis,serena,kaos,genus,lumine,rhea,solus,aion.',
    'Se o pedido indicar "todos/12", ative os 12.',
    'Texto pt-BR. APENAS JSON válido.'
  ].join('\n');

  const HORUS_VALIDATE = [
    'Você é **Horus Dual**, validador e auditor.',
    'Receberá um JSON de plano (ativacoes + tarefas).',
    'Valide, corrija inconsistências e devolva APENAS JSON no mesmo formato.',
    'Se tudo ok, retorne igual com campo "validado": true.'
  ].join('\n');

  const AGENT_SYS = (name)=>([
    `Você é **${actorLabel(name)}**.`,
    'Responda APENAS JSON: { "tarefaId":"...", "posso_fazer":true, "plano_execucao":"...", "eta_texto":"...", "resultado_preliminar":"...", "artefatos":[] }'
  ].join('\n'));

  const KOBLUX_CONSOLIDATE = [
    'Você é **KOBLUX**, consolidador final.',
    'Monte a resposta final com os blocos:',
    '### Recompensa Inicial\n### Curiosidade & Expansão\n### Antecipação Vibracional',
    'Se o JSON validado tiver "validado": true, inclua uma frase sutil: "(Plano validado por Horus)".'
  ].join('\n');

  function wantsAll(t){ return WANT_ALL_RE.test(String(t||'')) }

  async function runFlow(userText){
    const name = getUserName();
    const sk = getKey();
    if(!sk){ try{ if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText) }catch{}; return; }

    // 0) Single override
    if (String(userText||'').trim().toLowerCase().startsWith('@single')){
      const pure = userText.replace(/^@single\s*/i,'');
      if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(pure);
      return;
    }

    pushStatus('🧭 KOBLUX organizando…');
    // 1) KOBLUX planeja
    let planRaw = '';
    try{
      const hints = wantsAll(userText) ? '\nNota: o usuário pediu TODOS os 12 arquétipos.' : '';
      planRaw = await callOpenRouter([
        { role:'system', content: KOBLUX_PLAN },
        { role:'user', content: `Usuário: ${name}\nPedido: ${userText}${hints}` }
      ], { max_tokens: 900, temperature: 0.45 });
    }catch(e){ pushStatus('⚠️ Falha ao planejar com KOBLUX.'); if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText); return; }
    let plan = coerceJSON(planRaw);
    if(!plan){ pushStatus('⚠️ Plano inválido do KOBLUX. Indo em single.'); if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText); return; }
    if (wantsAll(userText)) plan.ativacoes = [...ALL];

    // 2) HORUS valida
    pushStatus('🛡️ Horus validando plano…');
    let validatedRaw = '';
    try{
      validatedRaw = await callOpenRouter([
        { role:'system', content: HORUS_VALIDATE },
        { role:'user', content: JSON.stringify(plan) }
      ], { max_tokens: 700, temperature: 0.2 });
    }catch(e){ /* se falhar, segue com o plano do KOBLUX */ }
    const validated = coerceJSON(validatedRaw) || { ...plan, validado:false };

    // Normalize ativacoes/tarefas
    let ativ = Array.isArray(validated.ativacoes) ? validated.ativacoes.map(a=>String(a||'').toLowerCase()) : [];
    ativ = ativ.map(a=>a==='ion'?'aion':a).filter(a=>ALL.includes(a));
    let tarefas = Array.isArray(validated.tarefas) ? validated.tarefas.slice() : [];
    const hasTaskFor = new Set(tarefas.map(t => (String(t.agente||'').toLowerCase()==='ion'?'aion':String(t.agente||'').toLowerCase())));
    ativ.forEach(key=>{ if(!hasTaskFor.has(key)) tarefas.push({ id:'T_'+key.toUpperCase(), agente:key, objetivo:`Contribuir com perspectiva ${actorLabel(key)} ao pedido`, entradas:[], entregavel:'Resumo estruturado' }) });

    agentPush('koblux', `Plano: ${ativ.map(a=>actorLabel(a)).join(', ')}${validated.validado?' (validado por Horus)':''}.`);

    // 3) Execução paralela
    pushStatus('🧪 Agentes executando…');
    const calls = tarefas.map(t => {
      let key = String(t.agente||'').toLowerCase(); if (key==='ion') key='aion';
      const sys = AGENT_SYS(actorLabel(key));
      const user = [`Tarefa ${t.id||''}: ${t.objetivo||''}`, `Entradas: ${JSON.stringify(t.entradas||[])}`, `Entregável: ${t.entregavel||'Texto estruturado.'}`].join('\n');
      return callOpenRouter([ {role:'system', content: sys}, {role:'user', content: user} ], { max_tokens: 700, temperature: 0.65 })
        .then(raw => ({ actor:key, raw, t })).catch(err => ({ actor:key, error:String(err), t }));
    });
    const results = await Promise.all(calls);
    const replies = [];
    for (const r of results){
      if (r.error){ agentPush(r.actor, `Falha em ${r.t?.id||''}.`); replies.push({ agente:r.actor, erro:r.error, tarefa:r.t }); continue; }
      const j = coerceJSON(r.raw) || {}; const resumo = j.resultado_preliminar || r.raw; const eta = j.eta_texto || 'em breve';
      const plano = j.plano_execucao ? (' '+j.plano_execucao) : '';
      agentPush(r.actor, `OK ${r.t?.id||''}.${plano} Entrego ${eta}. Resumo: ${resumo}`);
      replies.push({ agente:r.actor, tarefaId: j.tarefaId||r.t?.id, reply:j });
    }

    // 4) Consolidação KOBLUX
    pushStatus('🧩 KOBLUX consolidando…');
    let finalText='';
    try{
      finalText = await callOpenRouter([
        { role:'system', content: KOBLUX_CONSOLIDATE },
        { role:'user', content: `Pedido original: ${userText}` },
        { role:'assistant', content: `PLANO_VALIDADO:\n${JSON.stringify({ ...validated, ativacoes:ativ, tarefas })}` },
        { role:'assistant', content: `RESPOSTAS:\n${JSON.stringify(replies)}` }
      ], { max_tokens: 1200, temperature: 0.5 });
    }catch(e){ finalText='Consolidação indisponível.' }
    if (typeof window.renderAssistantReply==='function') window.renderAssistantReply(finalText); else agentPush('koblux', finalText);
  }

  // Hook: ALWAYS-ON by default; allow @single to bypass
  if (typeof window.sendUserMessage === 'function' && !window.__sendUserMessageSingle) {
    window.__sendUserMessageSingle = window.sendUserMessage;
    window.sendUserMessage = function(message){
      return runFlow(String(message||''));
    };
  }
})();
