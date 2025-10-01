
// Dual Multi‑Agent Plug‑in — v12 (HARD‑LOCKED model) — SAFER WRAP
// Changes vs original:
// 1) Only triggers multi‑agent when message starts with "@horus" (prefix), not on any "horus" mention.
// 2) Adds small guards to avoid double‑wrapping sendUserMessage.
// 3) Same MODEL_SLUG hard‑lock behavior.
//
// Drop‑in replacement for dual_multiagent_v12_locked.js
(function(){
  const MODEL_SLUG = "meta-llama/llama-3.1-8b-instruct:free";

  if (window.__MULTI_V12_SAFER__) return; // prevent double load
  window.__MULTI_V12_SAFER__ = true;

  const $ = (q,r=document)=>r.querySelector(q);
  const LS = { get:(k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d }catch{ return d } } };

  function actorLabel(a){ const m={horus:'Horus Dual',atlas:'Atlas',nova:'Nova',vitalis:'Vitalis',pulse:'Pulse',artemis:'Artemis',serena:'Serena',kaos:'Kaos',genus:'Genus',lumine:'Lumine',rhea:'Rhea',solus:'Solus',aion:'Aion (Ion)',ion:'Aion (Ion)'}; return m[a]||a; }
  function getUserName(){ return (localStorage.getItem('dual.name')||localStorage.getItem('infodose:userName')||'Dual').trim(); }
  function getKey(){ return (localStorage.getItem('dual.keys.openrouter')||localStorage.getItem('infodose:sk')||'').trim(); }
  function pushStatus(t){ try{ if(typeof feedPush==='function') feedPush('status', t) }catch{} }
  function agentPush(actor, text){ const feed=document.getElementById('chatFeed'); if(!feed) return; const wrap=document.createElement('div'); wrap.className='msg '+(actor||'ai'); const who=document.createElement('div'); who.style.fontWeight='900'; who.style.marginBottom='4px'; who.textContent=actorLabel(actor); const p=document.createElement('div'); p.textContent=text; wrap.appendChild(who); wrap.appendChild(p); feed.appendChild(wrap); feed.scrollTop=feed.scrollHeight; try{ if(window.ChatStore && typeof ChatStore.append==='function') ChatStore.append('assistant', actorLabel(actor)+': '+text) }catch{} }

  function coerceJSON(s){ if(!s) return null; try{ return JSON.parse(s) }catch{} const m=/```(?:json)?\s*([\s\S]*?)\s*```/i.exec(s); if(m){ try{ return JSON.parse(m[1]) }catch{} } const i=s.indexOf('{'), j=s.lastIndexOf('}'); if(i>=0 && j>i){ try{ return JSON.parse(s.slice(i,j+1)) }catch{} } return null; }

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

  const REPLY_HINT = '{ "tarefaId":"T1","posso_fazer":true,"plano_execucao":"passos breves","eta_texto":"~2 horas","resultado_preliminar":"…","artefatos":[] }';
  const HORUS_PLAN_SYSTEM = [
    'Você é **Horus Dual**, orquestrador.',
    '1) Entenda o pedido. 2) Decida quais arquétipos ativar dentre: atlas,nova,vitalis,pulse,artemis,serena,kaos,genus,lumine,rhea,solus,aion.',
    '3) Quebre em tarefas claras por arquétipo. 4) Se a mensagem disser "todos", "os doze" ou "12", ative TODOS.',
    'Responda APENAS JSON válido no formato:',
    '{ "plano":"resumo curto", "ativacoes":["atlas","nova",...], "tarefas":[{"id":"T1","agente":"...","objetivo":"...","entradas":["..."],"entregavel":"..."}], "perguntas_ao_usuario":[] }',
    'Regras: agente ∈ {"atlas","nova","vitalis","pulse","artemis","serena","kaos","genus","lumine","rhea","solus","aion"}; texto pt-BR; nunca saia do JSON.'
  ].join('\n');
  const HORUS_CONSOLIDATE_SYSTEM = [
    'Você é **Horus Dual**, orquestrador. Produza a entrega final em 3 blocos:',
    '### Recompensa Inicial\n### Curiosidade & Expansão\n### Antecipação Vibracional'
  ].join('\n');
  const AGENTS = {
    atlas:{ sys:['Você é **Atlas** (planejamento).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    nova:{ sys:['Você é **Nova** (ideação).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    vitalis:{ sys:['Você é **Vitalis** (rotinas).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    pulse:{ sys:['Você é **Pulse** (som).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    artemis:{ sys:['Você é **Artemis** (pesquisa/rotas).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    serena:{ sys:['Você é **Serena** (acolhimento).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    kaos:{ sys:['Você é **Kaos** (disrupção).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    genus:{ sys:['Você é **Genus** (protótipos).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    lumine:{ sys:['Você é **Lumine** (lúdico).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    rhea:{ sys:['Você é **Rhea** (narrativa).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    solus:{ sys:['Você é **Solus** (harmonia).','Responda APENAS JSON:',REPLY_HINT].join('\n') },
    aion:{ sys:['Você é **Aion/Ion** (microações).','Responda APENAS JSON:',REPLY_HINT].join('\n') }
  };
  const ALL = Object.keys(AGENTS);

  function shouldMulti(s){
    const t = String(s||'').trim().toLowerCase();
    return t.startsWith('@horus'); // SAFER
  }
  function wantsAll(t){ const s=(t||'').toLowerCase(); return /\bos\s*doze\b|\btodos\b|\b12\b/.test(s) }

  async function runFlow(userText){
    const name = getUserName();
    const sk = getKey();
    if(!sk){ try{ if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText) }catch{}; return; }
    pushStatus('🧭 Horus analisando pedido…');
    // 1) Plano
    let planRaw=''; try{
      const hints = wantsAll(userText) ? '\nNota: o usuário pediu TODOS os 12 arquétipos.' : '';
      planRaw = await callOpenRouter([
        { role:'system', content: HORUS_PLAN_SYSTEM },
        { role:'user', content: `Usuário: ${name}\nPedido: ${userText}${hints}` }
      ], { max_tokens: 900, temperature: 0.4 });
    }catch(e){ pushStatus('⚠️ Falha ao planejar com Horus.'); if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText); return; }
    const plan = coerceJSON(planRaw); if(!plan){ pushStatus('⚠️ Plano inválido. Resposta única.'); if (typeof window.__sendUserMessageSingle==='function') return window.__sendUserMessageSingle(userText); return; }
    let ativ = Array.isArray(plan.ativacoes)? plan.ativacoes.map(a=>String(a||'').toLowerCase()) : [];
    ativ = ativ.map(a => a==='ion' ? 'aion' : a);
    if (wantsAll(userText)) ativ = [...ALL];
    if (!ativ.length && Array.isArray(plan.tarefas)) {
      ativ = Array.from(new Set(plan.tarefas.map(t => String(t.agente||'').toLowerCase()).map(a=>a==='ion'?'aion':a))).filter(Boolean);
    }
    ativ = ativ.filter(a => ALL.includes(a));

    const tarefas = Array.isArray(plan.tarefas) ? plan.tarefas.slice() : [];
    const hasTaskFor = new Set(tarefas.map(t => (String(t.agente||'').toLowerCase()==='ion'?'aion':String(t.agente||'').toLowerCase())));
    ativ.forEach(key => { if(!hasTaskFor.has(key)) tarefas.push({ id:'T_'+key.toUpperCase(), agente:key, objetivo:`Contribuir com perspectiva ${actorLabel(key)} ao pedido`, entradas:[], entregavel:'Resumo estruturado' }) });
    agentPush('horus', `Plano ativado: ${ativ.map(a=>actorLabel(a)).join(', ')}.`);

    // 2) Exec paralela
    pushStatus('🧪 Arquétipos executando tarefas…');
    const calls = tarefas.map(t => {
      let key = String(t.agente||'').toLowerCase(); if (key==='ion') key='aion'; if (!AGENTS[key]) return Promise.resolve({ actor:key, error:'Agente desconhecido', t });
      const sys = AGENTS[key].sys;
      const user = [`Tarefa ${t.id||''}: ${t.objetivo||''}`, `Entradas: ${JSON.stringify(t.entradas||[])}`, `Entregável: ${t.entregavel||'Texto estruturado.'}`].join('\n');
      return callOpenRouter([ {role:'system', content: sys}, {role:'user', content: user} ], { max_tokens: 700, temperature: 0.65 })
        .then(raw => ({ actor:key, raw, t })).catch(err => ({ actor:key, error:String(err), t }));
    });
    const results = await Promise.all(calls);
    const replies = [];
    for (const r of results){
      if (r.error){ agentPush(r.actor, `Não consegui executar ${r.t?.id||''}.`); replies.push({ agente:r.actor, erro:r.error, tarefa:r.t }); continue; }
      const j = coerceJSON(r.raw) || {}; const resumo = j.resultado_preliminar || r.raw; const eta = j.eta_texto || 'em breve';
      const plano = j.plano_execucao ? (' '+j.plano_execucao) : '';
      agentPush(r.actor, `Consigo fazer ${r.t?.id||''}.${plano} Entrego ${eta}. Resumo: ${resumo}`);
      replies.push({ agente:r.actor, tarefaId: j.tarefaId||r.t?.id, reply:j });
    }

    // 3) Consolidação
    pushStatus('🧩 Horus consolidando…');
    let finalText=''; try{
      finalText = await callOpenRouter([
        { role:'system', content: HORUS_CONSOLIDATE_SYSTEM },
        { role:'user', content: `Pedido original: ${userText}` },
        { role:'assistant', content: `PLANO:\n${JSON.stringify({ ...plan, tarefas, ativacoes:ativ })}` },
        { role:'assistant', content: `RESPOSTAS:\n${JSON.stringify(replies)}` }
      ], { max_tokens: 1100, temperature: 0.5 });
    }catch(e){ finalText='Consolidação indisponível no momento.' }
    if (typeof window.renderAssistantReply==='function') window.renderAssistantReply(finalText); else agentPush('horus', finalText);
  }

  // Hook: only wrap once and only route when @horus prefix
  if (typeof window.sendUserMessage === 'function' && !window.__sendUserMessageSingle) {
    window.__sendUserMessageSingle = window.sendUserMessage;
    window.sendUserMessage = function(message){
      const msg = String(message||'').trim();
      if (shouldMulti(msg)) return runFlow(msg);
      return window.__sendUserMessageSingle(msg);
    };
  }
})();
