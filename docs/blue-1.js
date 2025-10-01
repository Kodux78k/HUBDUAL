
// Blue‑1 Chat integration
// Works with: HUB UNO (ChatPlus) and the KOBLLUX page (Gemini chat).
// Drop this file near your index and include: <script src="blue-1.js"></script>

(function(){
  const hasUNO = !!document.getElementById('v-chat');            // HUB UNO structure
  const hasKOBLLUX = !!document.getElementById('chat-history');  // KOBLLUX interface

  // 0) Force Blue‑1 theme unless user chose another one
  try {
    const LSget = (k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d }catch{return d} };
    const themeLS = (LSget('uno:theme') || '').toString();
    if (!document.body.dataset.theme || themeLS === 'blue1') {
      document.body.dataset.theme = 'blue1';
    }
  } catch {}

  // 1) Typing indicator helpers
  function showTyping(){
    const feed = document.getElementById('chatFeed');
    if (!feed || document.getElementById('kb__typing')) return;
    const wrap = document.createElement('div');
    wrap.id = 'kb__typing';
    wrap.className = 'msg ai';
    const inner = document.createElement('div');
    inner.className = 'kb-typing';
    inner.innerHTML = '<i></i><i></i><i></i>';
    wrap.appendChild(inner);
    feed.appendChild(wrap);
    feed.scrollTop = feed.scrollHeight;
  }
  function hideTyping(){
    const el = document.getElementById('kb__typing');
    if (el) el.remove();
  }

  // 2) If ChatPlus (UNO) is present, we only add typing overlay and tweak theme
  if (hasUNO && typeof window.sendAIMessageCtx === 'function'){
    const orig = window.sendAIMessageCtx;
    window.sendAIMessageCtx = async function(args){
      showTyping();
      try { return await orig(args); }
      finally { hideTyping(); }
    };
    // Ensure the chat view has Blue styling when opened
    try {
      const observer = new MutationObserver(()=>{
        const view = document.getElementById('v-chat');
        if (view && view.classList.contains('active')) {
          document.body.dataset.theme = 'blue1';
        }
      });
      observer.observe(document.body, { attributes:true, subtree:true, attributeFilter:['class'] });
    } catch{}
    // Done for UNO
    return;
  }

  // 3) KOBLLUX page: build a minimal Blue chat on top of existing page
  if (hasKOBLLUX){
    // Create #chatFeed host if missing
    let feed = document.getElementById('chatFeed');
    if (!feed){
      const host = document.createElement('div');
      host.className = 'kb-chat-host';
      feed = document.createElement('div');
      feed.id = 'chatFeed';
      host.appendChild(feed);
      const main = document.querySelector('main');
      (main || document.body).appendChild(host);
    }
    // Hide the original chat history (we keep the input bar)
    try {
      const old = document.getElementById('chat-history');
      if (old) old.style.display = 'none';
    } catch{}

    // Render helpers (subset of ChatPlus)
    function sanitizeHTML(input){
      try {
        const doc = new DOMParser().parseFromString(String(input||''), 'text/html');
        doc.querySelectorAll('script,style,link,iframe,object,embed,meta').forEach(n=>n.remove());
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
        const allowedProtocols = ['http:','https:','data:'];
        while (walker.nextNode()){
          const el = walker.currentNode;
          [...el.attributes].forEach(a => {
            if (/^on/i.test(a.name) || a.name==='style') el.removeAttribute(a.name);
          });
          if (el.tagName === 'A'){
            const href = el.getAttribute('href') || '';
            try {
              const u = new URL(href, location.href);
              if (!allowedProtocols.includes(u.protocol)) el.removeAttribute('href');
            } catch { el.removeAttribute('href'); }
            el.setAttribute('target','_blank'); el.setAttribute('rel','noopener noreferrer');
          }
          if (el.tagName === 'IMG'){
            const src = el.getAttribute('src') || '';
            if (!/^https?:|^data:image\//i.test(src)) el.removeAttribute('src');
            el.setAttribute('loading','lazy'); el.setAttribute('decoding','async');
            el.style.maxWidth = '100%'; el.style.borderRadius = '8px';
          }
        }
        return doc.body.innerHTML;
      } catch { return String(input||'').replace(/[<>]/g, c => c==='<'?'&lt;':'&gt;'); }
    }
    function paraToHTML(s){
      const esc = String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return esc.split(/\n{2,}/).map(p=>'<p>'+p.replace(/\n/g,'<br>')+'</p>').join('');
    }
    function extractHTMLFromFences(text){
      const m = /```html\s*([\s\S]*?)\s*```/i.exec(String(text||''));
      return m ? m[1] : null;
    }
    function splitBlocks(raw){
      const t = String(raw||'');
      const re1 = /###\s*Recompensa\s*Inicial[\s\S]*?(?=###\s*Curiosidade\s*&\s*Expans[aã]o|$)/i;
      const re2 = /###\s*Curiosidade\s*&\s*Expans[aã]o[\s\S]*?(?=###\s*Antecip[aã]o\s*Vibracional|$)/i;
      const re3 = /###\s*Antecip[aã]o\s*Vibracional[\s\S]*/i;
      const b1 = (t.match(re1)||[''])[0].replace(/###.*?\n?/,'').trim();
      const b2 = (t.match(re2)||[''])[0].replace(/###.*?\n?/,'').trim();
      const b3 = (t.match(re3)||[''])[0].replace(/###.*?\n?/,'').trim();
      return { b1, b2, b3 };
    }
    function createBlock(title, content){
      const details = document.createElement('details');
      details.className = 'ai-block';
      const summary = document.createElement('summary');
      summary.innerHTML = title;
      const body = document.createElement('div');
      body.className = 'block-body';
      const fenced = extractHTMLFromFences(content||'');
      if (fenced) body.innerHTML = '<div class="render-html">'+sanitizeHTML(fenced)+'</div>';
      else if (/<[a-z][\s\S]*>/i.test(content||'')) body.innerHTML = '<div class="render-html">'+sanitizeHTML(content)+'</div>';
      else body.innerHTML = paraToHTML(content||'');
      details.appendChild(summary); details.appendChild(body);
      return details;
    }
    function renderAssistantReply(raw){
      const row = document.createElement('div');
      row.className = 'msg ai-rich';
      const { b1, b2, b3 } = splitBlocks(raw||'');
      const d1 = createBlock('1) <strong>Recompensa Inicial</strong> ⚡', b1||'');
      const d2 = createBlock('2) <strong>Curiosidade &amp; Expansão</strong> 🔎', b2||'');
      const d3 = createBlock('3) <strong>Antecipação Vibracional</strong> ✨', b3||'');
      d1.open = true;
      row.appendChild(d1);
      row.appendChild(d2);
      row.appendChild(d3);
      feed.appendChild(row);
      feed.scrollTop = feed.scrollHeight;
    }
    function pushUser(text){
      const row = document.createElement('div');
      row.className = 'msg user';
      row.textContent = 'Você: ' + text;
      feed.appendChild(row);
      feed.scrollTop = feed.scrollHeight;
    }

    // Wire the existing input to Blue chat
    const form = document.getElementById('chat-form');
    const input = document.getElementById('user-input');
    if (form && input){
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const msg = input.value.trim(); if (!msg) return;
        input.value = '';
        pushUser(msg);
        showTyping();
        try {
          const BLUE_SYSTEM = [
            'Você é um assistente em português.',
            'Estruture SEMPRE a resposta em 3 blocos com os títulos exatos:',
            '### Recompensa Inicial',
            '### Curiosidade & Expansão',
            '### Antecipação Vibracional',
            'Se houver HTML em bloco, envolva em ```html ... ```.'
          ].join(' ');
          // Prefer Gemini (native on KOBLLUX)
          if (typeof window.callGeminiAPI === 'function'){
            const reply = await window.callGeminiAPI(msg, BLUE_SYSTEM);
            renderAssistantReply(reply || '…');
          } else {
            // Fallback (no API available)
            renderAssistantReply('### Recompensa Inicial\nNão foi possível contatar a IA agora.\n\n### Curiosidade & Expansão\nVerifique a API KEY no topo do arquivo.\n\n### Antecipação Vibracional\nTente novamente em alguns instantes.');
          }
        } catch (e){
          renderAssistantReply('### Recompensa Inicial\nErro inesperado.\n\n### Curiosidade & Expansão\n'+(e && e.message ? e.message : '')+'\n\n### Antecipação Vibracional\nRetome o fluxo e tente de novo.');
        } finally {
          hideTyping();
        }
      }, true);
    }
  }

})();