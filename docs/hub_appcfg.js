/* ===================== Helpers ===================== */
    const $ = (q, r = document) => r.querySelector(q);
    const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
    const LS = {
      get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch (e) { return d } },
      set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} },
      raw: (k) => localStorage.getItem(k) || ''
    };

    /* ===================== DualHub State & Logging ===================== */
    // Armazena preferências de performance, voz e registros de eventos para a funcionalidade "Dual" aprimorada.
    const dualState = {
      perf: localStorage.getItem('hub.perf') || 'med',
      voice: localStorage.getItem('hub.voice') || 'Nova',
      logs: []
    };
    // Adiciona uma entrada ao log e atualiza o painel de logs no Brain.
    function dualLog(msg) {
      const entry = '[' + new Date().toLocaleTimeString() + '] ' + msg;
      dualState.logs.unshift(entry);
      const logsEl = document.getElementById('logs');
      if(logsEl) logsEl.textContent = dualState.logs.slice(0, 60).join('\n');
    }

    /* Ripple */
    function addRipple(el) {
      if(!el) return;
      // Ensure a ripple host exists on the element. The global ripple handler will create dots on pointerdown.
      if(!el.querySelector('.ripple')) {
        const slot = document.createElement('span');
        slot.className = 'ripple';
        el.appendChild(slot);
      }
      // Do not attach individual pointerdown events here; ripple will be handled globally.
    }

    /* Toast */
    const toastBox = document.createElement('div');
    toastBox.style.cssText = 'position:fixed;right:14px;bottom:calc(var(--tabsH) + 16px);display:grid;gap:8px;z-index:120';
    document.body.appendChild(toastBox);
    function toast(msg, type = 'ok') {
      const el = document.createElement('div'); el.className = 'fx-trans';
      const bg = type === 'ok' ? 'linear-gradient(90deg,#1b2a2a,#123c2e)' : (type === 'warn' ? 'linear-gradient(90deg,#2f261b,#3c2d12)' : 'linear-gradient(90deg,#2f1b1b,#3c1212)');
      el.style.cssText = `background:${bg}; color:var(--fg); border:${getComputedStyle(document.documentElement).getPropertyValue('--bd')}; padding:.6rem .8rem; border-radius:12px; box-shadow:var(--shadow)`;
      el.textContent = msg; toastBox.appendChild(el);
      setTimeout(() => { el.style.opacity = .0; el.style.transform = 'translateY(6px)'; setTimeout(() => el.remove(), 220); }, 1600);
    }

    /* ===================== Saudação / último estado ===================== */
    function displayGreeting() {
      const card = document.getElementById('greetingCard');
      // Não exibir o cartão de saudação; usamos mensagens na bolinha
      if(card) card.style.display = 'none';
      const name = (localStorage.getItem('infodose:userName') || '').trim();
      const sessions = document.querySelectorAll('.session').length;
      if(!name) {
        showArchMessage('Salve! Ative sua Dual Infodose registrando seu nome na seção Brain.', 'warn');
      } else {
        showArchMessage(`Bem-vindo de volta, ${name}. UNO está ao seu lado. Você tem ${sessions} sessão(ões) ativa(s).`, 'ok');
      }
    }

    /* ===================== Tema & Fundo personalizados ===================== */
    // Aplica o tema salvo no localStorage. Os temas possíveis são: 'default' (remove data-theme), 'medium'
    // e 'custom'.  Quando 'custom' estiver ativo, usa a imagem/vídeo salvo em LS ('uno:bg') como
    // plano de fundo.  Se 'medium' estiver selecionado, adiciona data-theme='medium'.
    function applyTheme() {
      const theme = LS.get('uno:theme', 'medium');
      // Limpe qualquer dataset para que CSS default seja aplicado quando 'default'
      if(theme === 'default') {
        delete document.body.dataset.theme;
      } else {
        document.body.dataset.theme = theme;
      }
      // Gerenciar fundo personalizado
      const bgContainer = document.getElementById('custom-bg');
      if(!bgContainer) return;
      if(theme !== 'custom') {
        bgContainer.innerHTML = '';
        return;
      }
      // Carregar dados do fundo
      const bgData = LS.get('uno:bg', '');
      bgContainer.innerHTML = '';
      if(!bgData) return;
      // Determine se é vídeo ou imagem
      if(/^data:video\//.test(bgData)) {
        const vid = document.createElement('video');
        vid.src = bgData;
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.style.width = '100%';
        vid.style.height = '100%';
        vid.style.objectFit = 'cover';
        bgContainer.appendChild(vid);
      } else {
        const img = document.createElement('img');
        img.src = bgData;
        img.alt = '';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        bgContainer.appendChild(img);
      }
    }

    /* ===================== CSS Personalizado ===================== */
    // Aplica o CSS salvo em localStorage (chave 'infodose:cssCustom')
    function applyCSS() {
      let styleEl = document.getElementById('customStyle');
      if(!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'customStyle';
        document.head.appendChild(styleEl);
      }
      const css = localStorage.getItem('infodose:cssCustom') || '';
      styleEl.innerHTML = css || '';
    }

    // Inicializa seleção de vozes para cada arquétipo
    function initVoices() {
      const wrap = document.getElementById('voicesWrap');
      if(!wrap) return;
      // Substituir a UI de seleção de voz por uma interface simplificada.
      // Esta função agora atribui automaticamente vozes para cada arquétipo com base
      // nas vozes disponíveis (Português/Espanhol) e oferece dois botões:
      // "Atualizar Vozes" para recalcular o mapeamento e "Resetar Padrão" para
      // limpar quaisquer personalizações. O catálogo de vozes internas do iOS
      // (quando acessível) será utilizado na mesma lógica de filtragem do
      // SpeechSynthesis.
      wrap.innerHTML = '';
      // Lista de arquétipos compatíveis com o seletor do UNO
      const archList = [
        'Luxara','Rhea','Aion','Atlas','Nova','Genus',
        'Lumine','Kaion','Kaos','Horus','Elysha','Serena'
      ];
      // Cria parâmetros padrões de pitch e rate se ainda não existirem
      (function ensureArchParams(){
        const archParams = LS.get('infodose:archParams', {}) || {};
        if(Object.keys(archParams).length === 0){
          archList.forEach(key=>{
            archParams[key] = { pitch: 1.0, rate: 1.0 };
            if(/nova/i.test(key))   archParams[key] = { pitch: 1.1, rate: 1.05 };
            if(/atlas/i.test(key))  archParams[key] = { pitch: 0.95, rate: 1.0 };
            if(/horus/i.test(key))  archParams[key] = { pitch: 1.0, rate: 0.92 };
            if(/serena/i.test(key)) archParams[key] = { pitch: 1.05, rate: 0.95 };
          });
          LS.set('infodose:archParams', archParams);
        }
      })();
      // Atribui vozes automaticamente conforme as disponíveis
      function assignVoices(){
        const voices = speechSynthesis.getVoices().filter(v=> v.lang && (v.lang.startsWith('pt') || v.lang.startsWith('es')));
        const mapping = {};
        archList.forEach((name, idx)=>{
          const voice = voices[idx % voices.length];
          if(voice) mapping[name] = voice.name;
        });
        LS.set('infodose:voices', mapping);
        Toast.show('Vozes atribuídas','ok');
      }
      // Restaura configurações padrão removendo mapeamentos
      function resetVoices(){
        localStorage.removeItem('infodose:voices');
        localStorage.removeItem('infodose:archParams');
        Toast.show('Vozes resetadas','warn');
      }
      // Construir a UI simplificada
      const info = document.createElement('div');
      info.className = 'mut';
      info.style.fontSize = '11px';
      info.textContent = 'As vozes são atribuídas automaticamente para cada arquétipo. Use os botões abaixo para reatribuir ou restaurar as vozes padrão.';
      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '8px';
      const btnAssign = document.createElement('button');
      btnAssign.className = 'btn fx-trans fx-press ring';
      btnAssign.textContent = 'Atualizar Vozes';
      btnAssign.onclick = assignVoices;
      const btnReset = document.createElement('button');
      btnReset.className = 'btn fx-trans fx-press ring';
      btnReset.textContent = 'Resetar Padrão';
      btnReset.onclick = resetVoices;
      btnRow.appendChild(btnAssign);
      btnRow.appendChild(btnReset);
      wrap.appendChild(info);
      wrap.appendChild(btnRow);
      // Assign initial voices if none exist
      const savedVoices = LS.get('infodose:voices', {});
      if(!savedVoices || Object.keys(savedVoices).length === 0){
        assignVoices();
      }
      // Re-assign voices if the list of available voices changes
      window.speechSynthesis.onvoiceschanged = () => {
        const map = LS.get('infodose:voices', {});
        if(!map || Object.keys(map).length === 0){
          assignVoices();
        }
      };
    }

    // Pronuncia o nome do arquétipo usando a voz selecionada
    function speakArchetype(name) {
      try {
        const archName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        const saved = LS.get('infodose:voices', {});
        const voices = speechSynthesis.getVoices();
        let voice = null;
        if(saved && saved[archName]) {
          voice = voices.find(v => v.name === saved[archName]);
        }
        if(!voice) {
          voice = voices.find(v => v.lang && (v.lang.startsWith('pt') || v.lang.startsWith('en')));
        }
        if(!voice && voices.length) voice = voices[0];
        if(!voice) return;
        const utter = new SpeechSynthesisUtterance(`Olá, eu sou ${archName}`);
        utter.voice = voice;
        // Aplique pitch/velocidade personalizados
        try {
          const params = LS.get('infodose:archParams', {}) || {};
          const p = params[archName] || {};
          if(p.pitch) utter.pitch = p.pitch;
          if(p.rate)  utter.rate  = p.rate;
        } catch {}
        speechSynthesis.cancel();
        speechSynthesis.speak(utter);
      } catch (e) {}
    }

    // Fala um texto usando a voz associada ao arquétipo atualmente ativo.  Utiliza a lista
    // de vozes do Speech Synthesis e o mapeamento salvo em LS para encontrar a voz
    // correta. Se não houver voz definida, escolhe a primeira disponível (PT/EN).
    function speakWithActiveArch(text) {
      try {
        const select = document.getElementById('arch-select');
        let archFile = select ? select.value || '' : '';
        let base = archFile.replace(/\.html$/i, '');
        const key = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
        const saved = LS.get('infodose:voices', {}) || {};
        const voices = speechSynthesis.getVoices();
        let voice = null;
        if(saved[key]) {
          voice = voices.find(v => v.name === saved[key]);
        }
        if(!voice) {
          voice = voices.find(v => v.lang && (v.lang.startsWith('pt') || v.lang.startsWith('en')));
        }
        if(!voice && voices.length) voice = voices[0];
        if(!voice) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.voice = voice;
        // Aplique pitch/velocidade personalizadas
        try {
          const params = LS.get('infodose:archParams', {}) || {};
          const p = params[key] || {};
          if(p.pitch) utter.pitch = p.pitch;
          if(p.rate)  utter.rate  = p.rate;
        } catch {}
        speechSynthesis.cancel();
        speechSynthesis.speak(utter);
      } catch (e) {}
    }

    // Exibe uma mensagem dentro do círculo do arquétipo. A mensagem desaparece após alguns segundos.
    function showArchMessage(text, type = 'info') {
      try {
        const el = document.getElementById('archMsg');
        if(!el) return;
        el.textContent = text;
        // Ajuste a cor de fundo conforme o tipo
        if(type === 'ok') {
          el.style.background = 'rgba(57,255,182,0.75)';
          el.style.color = '#0b0f14';
        } else if(type === 'warn') {
          el.style.background = 'rgba(255,184,107,0.78)';
          el.style.color = '#0b0f14';
        } else if(type === 'err') {
          el.style.background = 'rgba(255,107,107,0.78)';
          el.style.color = '#0b0f14';
        } else {
          el.style.background = 'rgba(15,17,32,0.72)';
          el.style.color = '';
        }
        el.classList.add('show');
        clearTimeout(el._tm);
        // Mantenha a mensagem visível por mais tempo para melhor leitura
        el._tm = setTimeout(() => {
          el.classList.remove('show');
        }, 7000);
      } catch (e) {}
    }

    // Configura o modo de ripple que responde ao áudio do microfone.  Cria um
    // analisador de áudio usando Web Audio API e ajusta a opacidade da camada
    // "audioRipple" conforme a intensidade do som capturado. Um botão
    // (arch-audio) ativa/desativa o efeito de forma discreta.
    function initAudioRipple() {
      const clickLayer = document.getElementById('audioRipple');
      const archCircleEl = document.querySelector('.arch-circle');
      if(!clickLayer || !archCircleEl) return;
      let enabled = false;
      let audioCtx = null;
      let analyser = null;
      let micStream = null;
      // Inicia a captura de áudio e animação
      async function start() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStream = stream;
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const src = audioCtx.createMediaStreamSource(stream);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          animate();
        } catch (e) {
          toast('Não foi possível acessar o microfone.', 'err');
          enabled = false;
          archCircleEl.classList.remove('audio-on');
        }
      }
      // Para a captura de áudio e reseta a camada
      function stop() {
        if(micStream) {
          micStream.getTracks().forEach(t => t.stop());
          micStream = null;
        }
        if(audioCtx) {
          try { audioCtx.close(); } catch {}
          audioCtx = null;
        }
        // Remova o efeito de sombra quando desligar
        archCircleEl.style.boxShadow = '';
      }
      // Atualiza a opacidade da camada conforme o volume (RMS)
      function animate() {
        if(!enabled || !analyser) return;
        const buf = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        // Ajuste a intensidade: multiplique por um fator e limite a 0.6
        // Aplique um brilho em torno do círculo proporcional ao volume
        const intensity = Math.min(0.8, rms * 4);
        const blur = rms * 80;
        archCircleEl.style.boxShadow = `0 0 ${blur}px rgba(255,255,255,${intensity})`;
        requestAnimationFrame(animate);
      }
      // Clique simples no círculo inicia a interação Dual: anima a bolinha,
      // faz a saudação e inicia a captura de voz para conversar com a IA.
      clickLayer.addEventListener('click', () => {
        startDualInteraction();
      });

      // Função global para alternar o modo de visualização do áudio (ripple).  
      // Mantemos para compatibilidade com o botão de áudio no menu.
      window.toggleAudio = function () {
        enabled = !enabled;
        archCircleEl.classList.toggle('audio-on', enabled);
        if(enabled) {
          start();
        } else {
          stop();
        }
      };
    }

    // Mensagem de boas-vindas/ativação
    function welcome() {
      const name = (localStorage.getItem('infodose:userName') || '').trim();
      if(!name) {
        const msg = 'Salve! Ative sua Dual Infodose registrando seu nome na seção Brain.';
        showArchMessage(msg, 'warn');
        try { speakWithActiveArch(msg); } catch {}
      } else {
        const msg = `Bem-vindo de volta, ${name}. UNO está ao seu lado.`;
        showArchMessage(msg, 'ok');
        try { speakWithActiveArch(msg); } catch {}
      }
    }

    /* Apply ripple */
    $$('button').forEach(addRipple);
    // Move the arquétipos circle below the menu in the home view after initialization
    (function() {
      try {
        const home = document.getElementById('v-home');
        if(!home) return;
        const arch = home.querySelector('.arch-container');
        const cards = home.querySelector('.cards');
        // Se ambos existirem, garanta que as cartas apareçam depois do círculo de arquétipos.
        if(arch && cards) {
          arch.insertAdjacentElement('afterend', cards);
        }
      } catch (e) {
        console.warn('Falha ao reposicionar arquétipo:', e);
      }
    })();
    const obs = new MutationObserver((muts) => { muts.forEach(m => m.addedNodes && m.addedNodes.forEach(n => { if(n.nodeType === 1) { if(n.matches?.('button')) addRipple(n); n.querySelectorAll?.('button').forEach(addRipple); } })) });
    obs.observe(document.body, { childList: true, subtree: true });

    /* ===================== Navegação + Estado ===================== */
    function nav(key) {
      // Remapeia a antiga aba 'revo' para 'chat'
      if(key === 'revo') key = 'chat';
      // Adicionamos 'chat' à lista de abas para suportar a nova seção
      const tabs = ['home', 'apps', 'stack', 'brain', 'chat'];
      tabs.forEach(k => {
        const viewEl = document.getElementById('v-' + k);
        if(viewEl) viewEl.classList.toggle('active', k === key);
        const tabEl = document.querySelector(`.tab[data-nav="${k}"]`);
        if(tabEl) tabEl.classList.toggle('active', k === key);
      });
      LS.set('uno:lastTab', key);
      // Quando entrar na aba Home, apresente mensagem de saudação / última sessão
      if(key === 'home') {
        try { displayGreeting(); } catch (e) { console.warn(e); }
        try {
          const nameG = (localStorage.getItem('infodose:userName') || '').trim();
          if(!nameG) {
            toast('Salve! Ative sua Dual Infodose registrando seu nome na seção Brain.', 'warn');
          } else {
            // Saudação rápida na forma de toast quando o usuário retorna ao home.
            toast(`Bem-vindo de volta, ${nameG}. UNO está ao seu lado.`, 'ok');
          }
        } catch (e) {}
        // Atualize também os status quando entrar no Home
        try { updateHomeStatus(); } catch {}
      }
      // Nenhuma ação especial ao entrar na aba de chat por enquanto

      // Falar uma frase curta ao trocar de aba, usando a voz do arquétipo ativo
      try {
        let phrase = '';
        let type = 'info';
        switch (key) {
          case 'home': phrase = ''; break;
          case 'apps': phrase = 'Abrindo apps'; break;
          case 'stack': phrase = 'Abrindo stack'; break;
          case 'brain': phrase = 'Abrindo usuário'; break;
          case 'chat': phrase = 'Abrindo chat'; break;
          default: phrase = '';
        }
        if(phrase) {
          speakWithActiveArch(phrase);
          showArchMessage(phrase, type);
        }
        // Mostrar o preview laranja somente na Home; escondê-lo nas outras abas
        try {
          const prev = document.getElementById('msgPreview');
          if(prev) {
            prev.style.display = (key === 'home' && prev.textContent) ? 'block' : 'none';
          }
        } catch (e) { console.warn(e); }
      } catch (e) {}
    }

    // Alterna a visibilidade do menu de arquétipos.  O menu fica
    // escondido/mostrado ao clicar no círculo (toque curto).  Este
    // helper é chamado por initAudioRipple().
    function toggleArchMenu() {
      const menu = document.getElementById('archMenu');
      if(!menu) return;
      menu.classList.toggle('show');
    }

    /**
     * Inicia a interação Dual ao tocar a bolinha.  Esta função aplica uma
     * animação breve de pressão à bolinha, fala a saudação “Oi DUAL” (ou
     * outra frase definida) usando a voz do arquétipo ativo e, em seguida,
     * verifica se o usuário está conectado (nome, chave do OpenRouter e
     * modelo selecionados).  Caso esteja tudo configurado, ativa o
     * reconhecimento de voz para captar a fala do usuário e prosseguir
     * com a conversa.  Caso contrário, exibe uma mensagem orientando o
     * usuário a preencher suas configurações no Brain.
     */
    function startDualInteraction() {
      const archCircle = document.querySelector('.arch-circle');
      if(!archCircle) return;
      // Animação de clique: adiciona classe 'pressed' brevemente
      archCircle.classList.add('pressed');
      setTimeout(() => archCircle.classList.remove('pressed'), 180);
      // Saudação falada
      const greet = 'Oi Dual';
      showArchMessage(greet, 'ok');
      try { speakWithActiveArch(greet); } catch {}
      // Após a saudação, aguarde um curto intervalo antes de iniciar a verificação
      setTimeout(() => {
        const sk = localStorage.getItem('dual.keys.openrouter') || '';
        const userName = (localStorage.getItem('infodose:userName') || '').trim();
        const model = LS.get('dual.openrouter.model');
        if(!sk || !userName || !model) {
          const warn = 'Configure nome, chave e modelo no Brain para conversar.';
          showArchMessage(warn, 'warn');
          return;
        }
        // Se estiver tudo configurado, inicie o reconhecimento de voz
        startSpeechConversation(userName, sk, model);
      }, 600);
    }

    /**
     * Inicia o reconhecimento de fala via Web Speech API.  Quando o usuário
     * terminar de falar, a transcrição é encaminhada para a função de
     * manipulação de mensagens, que enviará a pergunta ao modelo de IA e
     * lidará com a resposta.
     * @param {string} userName Nome do usuário (para personalizar respostas)
     * @param {string} sk Chave da API do OpenRouter
     * @param {string} model Modelo selecionado
     */

    // Insere mensagens no feed de IA da Home. Mantém somente as últimas 10 entradas.
    function feedPush(type, text) {
      // Adiciona mensagem ao feed de IA se existir (mantido para compatibilidade)
      const box = document.getElementById('iaFeed');
      if(box) {
        const div = document.createElement('div');
        div.className = 'msg ' + (type || 'status');
        div.textContent = text;
        box.appendChild(div);
        const msgs = box.querySelectorAll('.msg');
        const limit = 10;
        if(msgs.length > limit) {
          box.removeChild(msgs[0]);
        }
        box.scrollTop = box.scrollHeight;
      }
      // Envia a mensagem também ao feed de chat e atualiza o preview
      try {
        chatPush(type, text);
        if(type === 'ai') updatePreview(text);
      } catch (e) { console.warn(e); }
    }
    // Função auxiliar para adicionar mensagens ao feed de chat
    function chatPush(type, text) {
      const feed = document.getElementById('chatFeed');
      if(!feed) return;
      const div = document.createElement('div');
      div.className = 'msg ' + (type || 'status');
      div.textContent = text;
      feed.appendChild(div);
      const msgs = feed.querySelectorAll('.msg');
      const limit = 50;
      if(msgs.length > limit) {
        feed.removeChild(msgs[0]);
      }
      feed.scrollTop = feed.scrollHeight;
    }
    // Atualiza o preview laranja com a última resposta da IA
    function updatePreview(text) {
      const prev = document.getElementById('msgPreview');
      if(!prev) return;
      prev.textContent = text.replace(/\s+/g, ' ').trim();
      // Exibe o preview apenas se a página Home estiver ativa.  Caso
      // contrário, mantenha-o oculto para não interferir na visualização
      // das outras abas (chat, apps etc.).
      const homeView = document.getElementById('v-home');
      const isHomeActive = homeView && homeView.classList.contains('active');
      prev.style.display = isHomeActive ? 'block' : 'none';
    }
    function startSpeechConversation(userName, sk, model) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!SpeechRecognition) {
        showArchMessage('Reconhecimento de fala não suportado neste navegador.', 'err');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      // Referência ao botão de voz para animar durante a gravação
      const micBtn = document.getElementById('homeVoiceBtn');
      recognition.onstart = () => {
        showArchMessage('Estou ouvindo…', 'ok');
        feedPush('status', '🎙️ Ouvindo…');
        if(micBtn) micBtn.classList.add('recording');
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        if(transcript) {
          // Pare imediatamente de escutar
          try { recognition.stop(); } catch{}
          feedPush('user', 'Você: ' + transcript);
          showArchMessage('Pulso enviado. Recebendo intenção…', 'ok');
          try{ speakWithActiveArch('Pulso enviado, recebendo intenção.'); }catch(e){}
          feedPush('status', '⚡ Pulso enviado · recebendo intenção…');
          handleUserMessage(transcript, userName, sk, model);
        }
      };
      recognition.onerror = (e) => {
        console.error('Erro no reconhecimento de fala:', e);
        showArchMessage('Erro no reconhecimento de fala.', 'err');
        feedPush('status', '❌ Erro no reconhecimento de fala.');
      };
      recognition.onend = () => {
        if(micBtn) micBtn.classList.remove('recording');
      };
      recognition.start();
    }

    /**
     * Processa a mensagem falada pelo usuário.  Exibe a transcrição no
     * feedback, envia a mensagem ao modelo de IA via OpenRouter e, ao
     * receber a resposta, exibe e fala a resposta de volta.
     * @param {string} text Texto transcrito da fala do usuário
     * @param {string} userName Nome do usuário
     * @param {string} sk Chave OpenRouter
     * @param {string} model Modelo de IA
     */
    async function handleUserMessage(text, userName, sk, model) {
      // A mensagem do usuário já foi adicionada ao feed no evento onresult do reconhecimento de fala
      // Monta prompt incluindo o nome do usuário para personalização
      const prompt = `${userName} disse: ${text}`;
      // Envia ao modelo de IA
      let reply = '';
      try {
        reply = await sendAIMessage(prompt, sk, model);
      } catch (err) {
        console.error('Falha ao consultar IA:', err);
        reply = 'Desculpe, não consegui responder no momento.';
      }
      if(reply) {
        // Determine o arquétipo ativo para prefixar as respostas no feed
        let archName = 'Dual';
        try {
          const select = document.getElementById('arch-select');
          let base = (select?.value || '').replace(/\.html$/i, '');
          archName = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
        } catch (e) {}
        feedPush('ai', archName + ': ' + reply);
        showArchMessage(reply, 'ok');
        try { speakWithActiveArch(reply); } catch {}
      }
    }

    /**
     * Envia uma mensagem ao endpoint de chat do OpenRouter.  Esta função
     * utiliza a API de chat completions para obter uma resposta do modelo
     * selecionado.  Caso não seja possível acessar a API (por exemplo,
     * se a aplicação estiver offline), uma resposta de erro é retornada.
     * @param {string} content Conteúdo da mensagem/prompt
     * @param {string} sk Chave de API
     * @param {string} model Identificador do modelo
     * @returns {Promise<string>} Resposta do modelo
     */
    async function sendAIMessage(content, sk, model) {
      // Estrutura de payload conforme especificação do OpenRouter
      const payload = {
        model: model,
        messages: [
          { role: 'system', content: 'Você é um assistente amistoso que responde em português.' },
          { role: 'user', content: content }
        ],
        max_tokens: 200,
        temperature: 0.7
      };
      const url = 'https://openrouter.ai/api/v1/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sk}`
        },
        body: JSON.stringify(payload)
      });
      if(!res.ok) {
        throw new Error('Erro na API: ' + res.status);
      }
      const data = await res.json();
      const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      return reply || '';
    }

    // Delegue cliques dentro do menu para a função de navegação.
    document.addEventListener('DOMContentLoaded', () => {
      const menu = document.getElementById('archMenu');
      if(menu) {
      menu.addEventListener('click', (e) => {
        // Primeiro verifique se o botão de áudio foi clicado
        const audioBtn = e.target.closest('button[data-audio]');
        if(audioBtn) {
          // Alterna modo áudio usando a função global
          if(typeof toggleAudio === 'function') {
            toggleAudio();
          }
          // Atualize o estado visual do botão
          const archCircle = document.querySelector('.arch-circle');
          if(archCircle) {
            audioBtn.classList.toggle('on', archCircle.classList.contains('audio-on'));
          }
          // Não feche o menu ao alternar áudio
          return;
        }
        // Caso contrário, delegue a navegação para botões com data-nav
        const btn = e.target.closest('button[data-nav]');
        if(btn) {
          nav(btn.getAttribute('data-nav'));
          menu.classList.remove('show');
        }
      });
      }
      // Clique no preview direciona ao chat
      const mp = document.getElementById('msgPreview');
      if(mp) mp.addEventListener('click', () => nav('chat'));

      /* Formulário de chat removido: a captura de mensagens é feita via
         overlay de entrada. */

      // Inicialização dos botões de texto e voz na Home (overlay).  Dois botões
      // empilhados acima da barra: o superior inicia reconhecimento de voz e
      // o inferior mostra o campo de texto. O envio do formulário do
      // overlay dispara a mesma lógica do chat padrão.
      const textBtn = document.getElementById('homeTextBtn');
      const voiceBtn = document.getElementById('homeVoiceBtn');
      const hiOverlay = document.getElementById('homeInputOverlay');
      const hiForm = document.getElementById('homeInputForm');
      const hiInput = document.getElementById('homeInput');
      // Exibe/oculta o overlay ao tocar no botão de texto
      if(textBtn && hiOverlay && hiForm && hiInput) {
        textBtn.addEventListener('click', () => {
          const show = hiOverlay.style.display !== 'block';
          hiOverlay.style.display = show ? 'block' : 'none';
          textBtn.classList.toggle('active', show);
          if(show) setTimeout(() => hiInput.focus(), 60);
        });
        hiForm.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const msg = hiInput.value.trim();
          if(!msg) return;
          feedPush('user', 'Você: ' + msg);
          showArchMessage('Pulso enviado. Recebendo intenção…', 'ok');
try{ speakWithActiveArch('Pulso enviado, recebendo intenção.'); }catch(e){}
feedPush('status', '⚡ Pulso enviado · recebendo intenção…');
          const userName = (localStorage.getItem('dual.name') || localStorage.getItem('infodose:userName') || '').trim();
          const sk = (localStorage.getItem('dual.keys.openrouter') || localStorage.getItem('infodose:sk') || '').trim();
          let mdl = LS.get('dual.openrouter.model');
          if(!mdl) mdl = (localStorage.getItem('infodose:model') || '').trim() || 'openrouter/auto';
          try { handleUserMessage(msg, userName, sk, mdl); } catch (e) { console.warn(e); }
          hiInput.value = '';
        });
      }
      // Inicia conversa por voz ao tocar no botão de voz
      if(voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          const userName = (localStorage.getItem('dual.name') || localStorage.getItem('infodose:userName') || '').trim();
          const sk = (localStorage.getItem('dual.keys.openrouter') || localStorage.getItem('infodose:sk') || '').trim();
          let mdl = LS.get('dual.openrouter.model');
          if(!mdl) mdl = (localStorage.getItem('infodose:model') || '').trim() || 'openrouter/auto';
          if(hiOverlay) hiOverlay.style.display = 'none';
          if(typeof startSpeechConversation === 'function') {
            startSpeechConversation(userName, sk, mdl);
          }
        });
      }
    });

    // Helper: se a aba Revo estiver ativa, envia a lista atual de apps ao iframe.  
    function maybeSendAppsToRevo() {
      // Revo foi substituído pelo Chat; nenhuma mensagem precisa ser enviada
      return;
    }
    $$('.tab,[data-nav]').forEach(b => b.addEventListener('click', () => nav(b.dataset.nav || 'home')));
    $('#btnBack').onclick = () => { try { history.length > 1 && history.back() } catch { } };
    $('#btnBrain').onclick = () => nav('brain');

    // Restaurar última aba
    let last = LS.get('uno:lastTab', 'home');
    // Se o último tab salvo for 'revo', redirecione para home para evitar páginas vazias
    if(last === 'revo') last = 'home';
    nav(last);
    // Se a aba inicial for home, exibir saudação
    if(last === 'home') {
      try { displayGreeting(); } catch(e) {}
    }

    // Atalhos
    let gPressed = false;
    window.addEventListener('keydown', (e) => {
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); downloadSelf(); return; }
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#appSearch')?.focus(); return; }
      if(e.key.toLowerCase() === 'g') { gPressed = true; setTimeout(() => gPressed = false, 600); return; }
      if(!gPressed) return; const k = e.key.toLowerCase();
      if(k === 'h') nav('home'); if(k === 'a') nav('apps'); if(k === 's') nav('stack'); if(k === 'b') nav('brain'); if(k === 'r') nav('chat'); gPressed = false;
    });

    // Ajuda modal
    const modalHelp = $('#modalHelp');
    $('#btnHelp').onclick = () => { modalHelp.classList.add('open'); modalHelp.setAttribute('aria-hidden', 'false'); };
    $('#closeHelp').onclick = () => { modalHelp.classList.remove('open'); modalHelp.setAttribute('aria-hidden', 'true'); };
    modalHelp.addEventListener('click', (e) => { if(e.target === modalHelp) $('#closeHelp').click(); });

    // Baixar HTML
    function downloadSelf() {
      try {
        const clone = document.documentElement.cloneNode(true);
        const html = '<!doctype html>\n' + clone.outerHTML;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'HUB-UNO.html'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
        toast('HTML exportado', 'ok');
      } catch (e) { alert('Falha ao exportar: ' + e.message); }
    }
    $('#btnDownload').onclick = downloadSelf;

    /* ===================== Brain ===================== */
    // Lista de modelos disponíveis no seletor. Inclui opções gratuitas e
    // experimentais (como Grok), além de modelos comerciais. Ajuste conforme
    // sua conta no OpenRouter ou serviço equivalente. Modelos não suportados
    // serão ignorados pela API.
    const MODELS = [
      // Lista de modelos gratuitos baseada em fontes recomendadas. Todos os modelos pagos foram removidos.
      // Consulte a matéria "Best Free AI Models You Can Use on OpenRouter" para obter detalhes técnicos【486128416830634†L64-L70】【486128416830634†L192-L224】.
      'meta-llama/llama-4-maverick:free',
      'meta-llama/llama-4-scout:free',
      'moonshotai/kimi-vl-a3b-thinking:free',
      'nvidia/llama-3.1-nemotron-nano-8b-v1:free',
      'google/gemini-2.5-pro-exp-03-25:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'deepseek/deepseek-v3-base:free',
      'deepseek/deepseek-chat-v3-0324:free',
      'deepseek/deepseek-r1-zero:free',
      'qwen/qwen2.5-vl-3b-instruct:free',
      'nousresearch/deephermes-3-llama-3-8b-preview:free'
    ];
    (function initBrain() {
      const sel = $('#model'); sel.innerHTML = ''; MODELS.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; sel.appendChild(o) });
      sel.value = LS.get('dual.openrouter.model', MODELS[0]);
      $('#sk').value = LS.raw('dual.keys.openrouter');
      $('#saveSK').onclick = () => { LS.set('dual.openrouter.model', sel.value); localStorage.setItem('dual.keys.openrouter', $('#sk').value || ''); toast('Configurações salvas', 'ok'); };
      $('#saveName').onclick = () => {
        localStorage.setItem('infodose:userName', ($('#userName').value || '').trim());
        toast('Nome salvo', 'ok');
        try { displayGreeting(); } catch (e) {}
        try { updateHomeStatus(); } catch {}
      };

      // === Campo para nomear a sua Dual Infodose ===
      // Insere dinamicamente um cartão para configurar o nome do assistente (Dual)
      try {
        const grid = document.querySelector('#v-brain .grid');
        if(grid && !document.getElementById('dualName')) {
          const card = document.createElement('div');
          card.className = 'card fx-trans fx-lift';
          card.style.display = 'block';
          card.innerHTML = '<div style="font-weight:800">Nome do Dual</div>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-top:6px">' +
            '<input id="dualName" class="input ring" placeholder="Nome do seu assistente" />' +
            '<button id="saveDualName" class="btn prime fx-trans fx-press ring">Salvar<span class="ripple"></span></button>' +
            '</div>';
          // Insira este cartão logo após o cartão do usuário
          const ref = grid.children[1];
          grid.insertBefore(card, ref);
          const dualInp = card.querySelector('#dualName');
          const btnSave = card.querySelector('#saveDualName');
          dualInp.value = (localStorage.getItem('dual.infodoseName') || '').trim();
          btnSave.onclick = () => {
            localStorage.setItem('dual.infodoseName', (dualInp.value || '').trim());
            toast('Nome do Dual salvo', 'ok');
          };
        }
      } catch(e) {}

      // Permitir adicionar modelo personalizado
      const addBtn = $('#addModel');
      const customInput = $('#customModel');
      if(addBtn && customInput) {
        addBtn.onclick = () => {
          const val = (customInput.value || '').trim();
          if(!val) return;
          const opt = document.createElement('option');
          opt.value = val; opt.textContent = val;
          sel.appendChild(opt);
          sel.value = val;
          LS.set('dual.openrouter.model', val);
          customInput.value = '';
          toast('Modelo adicionado', 'ok');
        };
      }
      // Permitir carregamento de arquivo de treino
      const trainInp = $('#trainingFile');
      if(trainInp) {
        trainInp.addEventListener('change', (ev) => {
          const file = ev.target.files && ev.target.files[0];
          if(!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              LS.set('dual.openrouter.training', { name: file.name, data: reader.result });
              toast('Treinamento carregado', 'ok');
            } catch (err) { console.error(err); toast('Erro ao carregar treino', 'err'); }
          };
          reader.readAsDataURL(file);
        });
      }
    })();

    /* ===================== Inicialização do tema & personalização de fundo ===================== */
    (function initThemeSettings() {
      // Se o usuário nunca selecionou um tema antes, defina o padrão como "medium" (cinza).
      if(!LS.get('uno:theme')) {
        LS.set('uno:theme', 'medium');
      }
      // Aplique o tema salvo imediatamente
      applyTheme();
      // Configure o seletor de tema
      const sel = document.getElementById('themeSelect');
      if(sel) {
        sel.value = LS.get('uno:theme', 'medium');
        sel.addEventListener('change', () => {
          LS.set('uno:theme', sel.value);
          applyTheme();
          toast('Tema atualizado', 'ok');
          try { updateHomeStatus(); } catch {}
        });
      }
      const upload = document.getElementById('bgUpload');
      if(upload) {
        upload.addEventListener('change', (e) => {
          const f = e.target.files && e.target.files[0];
          if(!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              LS.set('uno:bg', reader.result);
              LS.set('uno:theme', 'custom');
              if(sel) sel.value = 'custom';
              applyTheme();
              toast('Fundo personalizado salvo', 'ok');
              try { updateHomeStatus(); } catch {}
            } catch (err) { console.error(err); toast('Erro ao salvar fundo', 'err'); }
          };
          reader.readAsDataURL(f);
        });
      }
    })();

    /* ===================== Ícones inline (data SVG) ===================== */
    function svgIcon(name){
      const common = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23f5f7ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
      const m = {
        atlas: `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/><path d="M5 8c3 2 11 2 14 0M5 16c3-2 11-2 14 0"/></svg>`,
        nova: `<svg ${common}><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="3"/></svg>`,
        vitalis:`<svg ${common}><path d="M3 12h4l2-5 4 10 2-5h6"/><path d="M13 3l-2 4 3 1-2 4"/></svg>`,
        pulse: `<svg ${common}><path d="M2 12h3l2-4 3 8 2-4h8"/><path d="M20 8v-3M20 19v-3"/></svg>`,
        artemis:`<svg ${common}><path d="M3 12h12"/><path d="M13 6l6 6-6 6"/><circle cx="12" cy="12" r="9"/></svg>`,
        serena:`<svg ${common}><path d="M12 21s-6-3.5-6-8a4 4 0 0 1 6-3 4 4 0 0 1 6 3c0 4.5-6 8-6 8z"/></svg>`,
        kaos:  `<svg ${common}><path d="M4 4l7 7-7 7"/><path d="M20 4l-7 7 7 7"/></svg>`,
        genus: `<svg ${common}><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M7 7l5-3 5 3M17 17l-5 3-5-3"/></svg>`,
        lumine:`<svg ${common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
        rhea:  `<svg ${common}><path d="M12 3v6"/><circle cx="12" cy="9" r="4"/><path d="M12 13v2l-2 2M12 15l2 2M12 17v3"/></svg>`,
        solus: `<svg ${common}><path d="M12 3v6M12 15v6"/><circle cx="12" cy="12" r="3"/><path d="M19 5l-3 3M5 19l3-3M5 5l3 3M19 19l-3-3"/></svg>`,
        aion:  `<svg ${common}><path d="M7 12c0-2.2 1.8-4 4-4 1.2 0 2.3.5 3 1.3M17 12c0 2.2-1.8 4-4 4-1.2 0-2.3-.5-3-1.3"/><path d="M3 12h4M17 12h4"/></svg>`,
        // Extra icons provided by the user. These are approximations of the requested
        // assets (e.g. audio.svg, bolt.svg, etc.) using simple line art. They
        // maintain the same stroke characteristics as the existing icons. To use
        // them elsewhere in the UI, call svgIcon('audio'), svgIcon('bolt'), etc.
        audio: `<svg ${common}><polygon points="3,9 8,9 12,5 12,19 8,15 3,15"/><path d="M15 9c1.5 1.5 1.5 4 0 5"/><path d="M17 7c3 3 3 7 0 10"/></svg>`,
        bolt: `<svg ${common}><path d="M13 3L4 14h7l-2 7 9-11h-7l3-7z"/></svg>`,
        download: `<svg ${common}><path d="M12 3v12"/><path d="M6 9l6 6 6-6"/><path d="M5 19h14"/></svg>`,
        grid: `<svg ${common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
        home: `<svg ${common}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
        json: `<svg ${common}><path d="M7 4c-2 0-2 2-2 4v8c0 2 0 4 2 4"/><path d="M17 4c2 0 2 2 2 4v8c0 2 0 4-2 4"/></svg>`,
        'logo-capsule': `<svg ${common}><rect x="4" y="7" width="16" height="10" rx="5"/><path d="M12 7v10"/></svg>`,
        'logo-seed-split': `<svg ${common}><path d="M12 12c0-4 4-8 8-8v8c0 4-4 8-8 8v-8z"/><path d="M12 12c0-4-4-8-8-8v8c0 4 4 8 8 8v-8z"/></svg>`,
        pause: `<svg ${common}><rect x="6" y="4" width="3" height="16"/><rect x="15" y="4" width="3" height="16"/></svg>`,
        play: `<svg ${common}><polygon points="6,4 20,12 6,20"/></svg>`,
        upload: `<svg ${common}><path d="M12 21V9"/><path d="M6 15l6-6 6 6"/><path d="M5 5h14"/></svg>`,
        user: `<svg ${common}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-8 8-8s8 4 8 8"/></svg>`,
        sprites: `<svg ${common}></svg>`
      };
      const raw = m[name] || m['atlas'];
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(raw);
    }

    /* ===================== Apps (embutido + locais) ===================== */
    // Lista de apps embutidos (arquetípicos) com suas chaves, títulos, descrições
    // e seeds. Essas entradas servem como base para a IA entender o contexto
    // dos arquétipos e para exibir informações no UI. Se adicionar novos
    // arquétipos em archList, inclua também aqui sua definição.
    const RAW = {
      apps: [
        { key: 'nova',    title: 'NOVA',    desc: 'ignição e nascimento do ciclo', seeds: 'explosion birth spark toroid' },
        { key: 'atlas',   title: 'ATLAS',   desc: 'estrutura, grade e ordem do mundo', seeds: 'structure atlas grid atlasian' },
        { key: 'vitalis', title: 'VITALIS', desc: 'organismo vivo e pulsante', seeds: 'life organics pulse' },
        { key: 'pulse',   title: 'PULSE',   desc: 'ritmo, batida e frequência', seeds: 'rhythm beat frequency' },
        { key: 'artemis', title: 'ARTEMIS', desc: 'caça, mira e precisão lunar', seeds: 'hunt moon precision' },
        { key: 'serena',  title: 'SERENA',  desc: 'calma d\'água e serenidade', seeds: 'calm water serene' },
        { key: 'kaos',    title: 'KAOS',    desc: 'ruído, fractalidade e desordem fértil', seeds: 'chaos fractal noise' },
        { key: 'genus',   title: 'GENUS',   desc: 'semente, gene e origem', seeds: 'seed gene origin' },
        { key: 'lumine',  title: 'LUMINE',  desc: 'luz, lumen e brilho', seeds: 'light lumen glow' },
        { key: 'rhea',    title: 'RHEA',    desc: 'fluxo-rio e matriz geradora', seeds: 'flow river mother' },
        { key: 'solus',   title: 'SOLUS',   desc: 'foco singular e solidão produtiva', seeds: 'alone focus singularity' },
        { key: 'aion',    title: 'AION',    desc: 'tempo cíclico e eternidade', seeds: 'eternal cycle time' }
      ]
    };

    // Controle para exibir apenas apps locais ou todos
    let showOnlyLocal = false;
    // Lista de apps favoritados (por chave). Carregada do localStorage
    let favoriteKeys = [];
    try { favoriteKeys = JSON.parse(localStorage.getItem('infodose:favApps') || '[]') || []; } catch { favoriteKeys = []; }

    /**
     * Alterna um app na lista de favoritos. Salva no localStorage e re-renderiza.
     * @param {string} key
     */
    function toggleFav(key) {
      const idx = favoriteKeys.indexOf(key);
      if(idx >= 0) {
        favoriteKeys.splice(idx, 1);
      } else {
        favoriteKeys.push(key);
      }
      localStorage.setItem('infodose:favApps', JSON.stringify(favoriteKeys));
      renderApps();
    }
    /** Verifica se um app está favoritado. */
    function isFav(key) {
      return favoriteKeys.includes(key);
    }
    const appsWrap = $('#appsWrap'), appsCount = $('#appsCount');

    function normalize(list) {
      return (list || []).map(x => ({
        key: x.key || x.url || x.title || Math.random().toString(36).slice(2),
        title: x.title || x.key || 'App',
        desc: x.desc || '',
        url: String(x.url || ''),
        icon: x.icon || '',
        tags: Array.isArray(x.tags) ? x.tags : []
      }))
    }
    function locals() {
      let arr = []; try { arr = JSON.parse(LS.raw('infodose:locals:v1') || '[]') } catch {}
      return arr.map(l => ({ key: 'local:' + l.id, title: l.name || 'Local', desc: 'HTML local', url: 'local:' + l.id, icon: 'local', tags: ['local'] }))
    }
    function getLocal(id) {
      let arr = []; try { arr = JSON.parse(LS.raw('infodose:locals:v1') || '[]') } catch {}
      return arr.find(x => x.id === id) || null
    }
    function blobURL(local) { const blob = new Blob([local.html || ''], { type: 'text/html;charset=utf-8' }); return URL.createObjectURL(blob) }

    /**
     * Atualiza os cartões de status na Home com informações atuais sobre apps, sessões,
     * preferências do usuário e arquétipo ativo. Chamado sempre que o
     * catálogo muda, quando sessões são abertas/fechadas, quando
     * configurações são salvas ou ao navegar para o Home.
     */
    function updateHomeStatus() {
      try {
        // Apps: número total ou locais se estiver filtrando
        const total = normalize(RAW.apps).concat(locals()).length;
        const localCount = locals().length;
        const txtApps = showOnlyLocal ? (localCount + ' local' + (localCount === 1 ? '' : 's')) : (total + ' app' + (total === 1 ? '' : 's'));
        const elApps = document.getElementById('homeAppsStatus');
        if(elApps) elApps.textContent = txtApps;
      } catch (e) {}
      try {
        // Sessões abertas (Stack)
        const sess = document.querySelectorAll('#stackWrap .session').length;
        const txtSess = sess + ' sessão' + (sess === 1 ? '' : 's');
        const elStack = document.getElementById('homeStackStatus');
        if(elStack) elStack.textContent = txtSess;
      } catch (e) {}
      try {
        // Usuário: nome + tema atual (mapa)
        const name = (localStorage.getItem('infodose:userName') || '').trim();
        const theme = LS.get('uno:theme', 'medium');
        const themeLabel = { 'default': 'padrão', 'medium': 'cinza', 'custom': 'personalizado' }[theme] || theme;
        let txtUser = name || 'Usuário';
        txtUser += ' · ' + themeLabel;
        const elUser = document.getElementById('homeUserStatus');
        if(elUser) elUser.textContent = txtUser;
      } catch (e) {}
      try {
        // Arquétipo ativo: obtém o nome sem extensão
        const sel = document.getElementById('arch-select');
        let archName = '';
        if(sel && sel.options.length > 0) {
          const opt = sel.options[sel.selectedIndex] || null;
          if(opt) archName = opt.textContent.replace(/\.html$/i, '');
        }
        const elArch = document.getElementById('homeArchStatus');
        if(elArch) elArch.textContent = archName || 'Nenhum';
      } catch (e) {}
    }

    function appIconFor(a){
      if(!a.icon) return svgIcon('atlas');
      if(/^(atlas|nova|vitalis|pulse|artemis|serena|kaos|genus|lumine|rhea|solus|aion|local)$/.test(a.icon)) return svgIcon(a.icon);
      return a.icon; // caminho externo
    }

    function cardApp(a) {
      const el = document.createElement('div'); el.className = 'app-card fx-trans fx-lift';
      // Botão de favorito (estrela). Aparece no canto superior direito
      const fav = document.createElement('button'); fav.className = 'fav-btn';
      const favImg = document.createElement('img');
      favImg.alt = 'Favorito';
      // Use ícone local para favorito; evita depender de CDN
      favImg.src = 'icons/star.svg';
      fav.appendChild(favImg);
      // Marque como favoritado se a chave estiver na lista
      if(isFav(a.key)) fav.classList.add('fav');
      fav.onclick = (e) => { e.stopPropagation(); toggleFav(a.key); };
      el.appendChild(fav);
      const ic = document.createElement('div'); ic.className = 'app-icon';
      const img = document.createElement('img'); img.alt = ''; img.width = 24; img.height = 24; img.src = appIconFor(a); ic.appendChild(img);
      const meta = document.createElement('div'); meta.style.flex = '1';
      // Truncar o título para exibir apenas as três primeiras palavras; adicionar reticências quando houver mais.
      const fullTitle = String(a.title || a.key || '').trim();
      const words = fullTitle.split(/\s+/);
      const truncated = words.slice(0, 3).join(' ');
      const displayTitle = words.length > 3 ? truncated + '…' : truncated;
      const t = document.createElement('div');
      t.className = 'app-title';
      t.textContent = displayTitle || fullTitle;
      // O título completo fica como tooltip para acesso total via hover
      t.title = fullTitle;
      const d = document.createElement('div'); d.className = 'mut'; d.textContent = a.desc || a.url;
      const open = document.createElement('button'); open.className = 'btn fx-trans fx-press ring'; open.textContent = 'Abrir';
      const rip = document.createElement('span'); rip.className = 'ripple'; open.appendChild(rip); addRipple(open);
      open.onclick = () => openApp(a);
      // Botão de remover para apps locais
      let rm = null;
      if(String(a.url || '').startsWith('local:')) {
        rm = document.createElement('button');
        rm.className = 'btn fx-trans fx-press ring';
        rm.style.padding = '0 6px';
        rm.title = 'Remover';
        rm.textContent = '×';
        const rr = document.createElement('span'); rr.className = 'ripple'; rm.appendChild(rr); addRipple(rm);
        rm.onclick = (ev) => {
          ev.stopPropagation();
          removeLocalApp(a.key);
        };
      }
      meta.appendChild(t);
      meta.appendChild(d);
      meta.appendChild(open);
      if(rm) meta.appendChild(rm);
      el.appendChild(ic);
      el.appendChild(meta);
      return el
    }

    function renderApps() {
      // Busque valores de busca e ordenação apenas se os campos existirem (evita erros se ocultos)
      const searchEl = document.getElementById('appSearch');
      const sortEl = document.getElementById('appSort');
      const q = searchEl ? (searchEl.value || '').toLowerCase() : '';
      const mode = sortEl ? sortEl.value : 'az';
      // Combine apps embutidos e locais
      let L = normalize(RAW.apps).concat(locals());
      // Filtrar apenas locais se ativado
      if(showOnlyLocal) {
        L = L.filter(a => String(a.url || '').startsWith('local:'));
      }
      // Aplicar busca (mantendo compatibilidade se o usuário ainda possuir o campo)
      if(q) {
        L = L.filter(a => (a.title + ' ' + a.desc + ' ' + a.key + ' ' + a.url + ' ' + (a.tags || []).join(' ')).toLowerCase().includes(q));
      }
      // Ordenar: favoritos primeiro, depois título A-Z ou Z-A conforme o select (padrão A-Z)
      L.sort((a, b) => {
        const favA = isFav(a.key); const favB = isFav(b.key);
        if(favA !== favB) return favB - favA; // true=1, false=0 => favoritos no topo
        const dir = mode === 'za' ? -1 : 1;
        return dir * String(a.title || '').localeCompare(b.title || '');
      });
      appsWrap.innerHTML = '';
      L.forEach(a => {
        const card = cardApp(a);
        appsWrap.appendChild(card);
      });
      appsCount.textContent = L.length + ' apps';
      // Reaplicar ícones após adicionar novos cards (garante que as estrelas e ícones de apps carreguem)
      try { applyIcons(); } catch {}
      // Notifique o Revo de que os apps mudaram, se estiver ativo
      maybeSendAppsToRevo();
      // Atualize o painel de status na home com o novo número de apps
      try { updateHomeStatus(); } catch {}
    }

    (function loadEmbeddedApps(){
      try {
        const raw = JSON.parse($('#APPS_JSON').textContent || '{}');
        RAW.apps = Array.isArray(raw.apps) ? raw.apps : (Array.isArray(raw) ? raw : []);
      } catch { RAW.apps = [] }
      // Marque abrir dentro por padrão quando carregar apps
      try {
        const openInside = document.getElementById('openInside');
        if(openInside) openInside.checked = true;
      } catch(e){}
      renderApps();
      // Sempre envie o catálogo atualizado ao iframe do Revo após carregar os apps embutidos.
      try {
        const iframe = document.getElementById('revoEmbed');
        if(iframe) {
          const apps = RAW && Array.isArray(RAW.apps) ? RAW.apps : [];
          const send = () => { if(iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'apps', apps }, '*'); };
          // Envie após pequeno atraso para garantir que o iframe esteja pronto
          setTimeout(send, 100);
          // E também quando o iframe terminar de carregar
          iframe.removeEventListener('load', iframe._sendAppsEmbedded);
          iframe._sendAppsEmbedded = send;
          iframe.addEventListener('load', send, { once: true });
        }
      } catch(e) { console.warn('Falha ao postMessage apps após embed:', e); }
    })();

    // Locais
    $('#btnImport').onclick = async () => {
      const fs = Array.from($('#fileLocal').files || []);
      if(!fs.length) return;
      const tasks = fs.map(f => new Promise(res => {
        const r = new FileReader();
        r.onload = () => {
          const content = String(r.result || '');
          // Se for um arquivo JSON, tente carregá-lo como catálogo de apps
          if(/\.json$/i.test(f.name)) {
            try {
              const obj = JSON.parse(content);
              const apps = Array.isArray(obj.apps) ? obj.apps : (Array.isArray(obj) ? obj : []);
              // Substitua o catálogo embutido pelo JSON local e recarregue a lista
              RAW.apps = apps;
              renderApps();
              toast('apps.json local carregado', 'ok');
            } catch (err) {
              console.error(err);
              toast('Erro ao ler apps.json', 'err');
            }
            // Não adicionar JSON à lista de locais; retorne null
            res(null);
          } else {
            // Trate como HTML local
            res({ id: 'l_' + Math.random().toString(36).slice(2), name: f.name.replace(/\.(html?|txt)$/i, ''), html: content, ts: Date.now() });
          }
        };
        r.readAsText(f);
      }));
      const list = (await Promise.all(tasks)).filter(Boolean);
      const cur = JSON.parse(LS.raw('infodose:locals:v1') || '[]');
      list.forEach(x => cur.unshift(x));
      localStorage.setItem('infodose:locals:v1', JSON.stringify(cur));
      renderApps();
      if(list.length) toast('HTMLs locais adicionados', 'ok');
    };
    $('#btnExport').onclick = () => { const data = { v: 1, when: Date.now(), items: JSON.parse(LS.raw('infodose:locals:v1') || '[]') }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'locals_pack.json'; a.click(); };
    $('#btnClear').onclick = () => { if(confirm('Limpar HTMLs locais salvos?')) { localStorage.removeItem('infodose:locals:v1'); renderApps(); toast('Locais limpos', 'warn'); } };

    // Alterna exibição de apps locais/apenas locais
    try {
      const btnToggleLocal = document.getElementById('btnToggleLocal');
      if(btnToggleLocal) {
        btnToggleLocal.onclick = () => {
          showOnlyLocal = !showOnlyLocal;
          // Atualize o texto do botão conforme o modo
          btnToggleLocal.firstChild && (btnToggleLocal.firstChild.nodeValue = showOnlyLocal ? 'Mostrar Todos' : 'Mostrar Locais');
          renderApps();
        };
      }
    } catch (e) { console.warn('Falha ao associar btnToggleLocal:', e); }

    /* ===================== Stack ===================== */
    const stackWrap = $('#stackWrap'), dock = $('#dock');
    function badge(item) { const b = document.createElement('button'); b.className = 'badge fx-trans fx-press ring'; b.textContent = item.title || 'App'; b.title = 'Reabrir ' + (item.title || 'App'); const rp = document.createElement('span'); rp.className = 'ripple'; b.appendChild(rp); addRipple(b); b.onclick = () => { const s = document.querySelector('[data-sid="' + item.sid + '"]'); if(s) { s.scrollIntoView({ behavior: 'smooth' }); s.classList.remove('min'); } }; return b }
    function updateDock() {
      dock.innerHTML = '';
      $$('.session').forEach(s => {
        const meta = JSON.parse(s.dataset.meta || '{}');
        dock.appendChild(badge({ title: meta.title, sid: s.dataset.sid }))
      });
      // Atualize o status de sessões na home
      try { updateHomeStatus(); } catch {}
    }
    function openApp(a) {
      const sid = 's_' + Math.random().toString(36).slice(2);
      const isLocal = String(a.url || '').startsWith('local:'); const lr = isLocal ? getLocal(String(a.url).slice(6)) : null; const url = lr ? blobURL(lr) : a.url;
      const card = document.createElement('div'); card.className = 'session fx-trans fx-lift'; card.dataset.sid = sid; card.dataset.meta = JSON.stringify({ title: a.title || 'App', url: a.url || '' });
      card.innerHTML = `
        <div class="hdr"><div class="title">${(a.title || 'App')}</div><div class="tools"><button class="btn ring fx-trans fx-press" data-act="min" title="Minimizar"><span style="font-size:16px;line-height:1">&minus;</span><span class="ripple"></span></button><button class="btn ring fx-trans fx-press" data-act="ref" title="Recarregar"><span style="font-size:16px;line-height:1">&#8635;</span><span class="ripple"></span></button><button class="btn ring fx-trans fx-press" data-act="close" title="Fechar"><span style="font-size:16px;line-height:1">&times;</span><span class="ripple"></span></button></div></div><iframe src="${url || 'about:blank'}" allow="autoplay; clipboard-read; clipboard-write; picture-in-picture; fullscreen"></iframe><div class="resize-handle" title="Arraste para ajustar a altura"></div>`;
      // Redimensionar altura do iframe arrastando o handle
      (function bindResize(){
        const handle = card.querySelector('.resize-handle');
        const iframe = card.querySelector('iframe');
        if(!handle || !iframe) return;
        let startY = 0, startH = 0, dragging = false;
        handle.addEventListener('pointerdown', (ev) => {
          dragging = true;
          startY = ev.clientY;
          startH = iframe.clientHeight;
          handle.setPointerCapture(ev.pointerId);
        });
        handle.addEventListener('pointermove', (ev) => {
          if(!dragging) return;
          const dy = ev.clientY - startY;
          const h = Math.max(120, startH + dy);
          iframe.style.height = h + 'px';
        });
        const stop = () => { dragging = false; };
        handle.addEventListener('pointerup', stop);
        handle.addEventListener('pointercancel', stop);
      })();
      // Prepend the session card dependendo do modo de abertura. Se "abrir dentro" estiver marcado,
      // insira a sessão no topo da página (sessionsAnchor); caso contrário, use o stackWrap padrão.
      const anchor = document.getElementById('sessionsAnchor');
      if($('#openInside').checked && anchor) {
        anchor.prepend(card);
      } else {
        stackWrap.prepend(card);
      }
      // Não chamar applyIcons aqui: ícones embutidos manualmente nos botões de sessão
      card.querySelector('[data-act=min]').onclick = () => {
        card.classList.toggle('min');
        updateDock();
        dualLog('Sessão minimizada: ' + (a.title || 'App'));
      };
      card.querySelector('[data-act=ref]').onclick = () => { const fr = card.querySelector('iframe'); try { fr.contentWindow.location.reload() } catch { fr.src = fr.src } };
      card.querySelector('[data-act=close]').onclick = () => {
        card.remove();
        updateDock();
        dualLog('Sessão fechada: ' + (a.title || 'App'));
      };
      // Navegue para a view Stack apenas quando não estiver abrindo dentro da página.
      if(!$('#openInside').checked) nav('stack');
      updateDock();
      toast('App aberto: ' + (a.title || 'App'), 'ok');
      dualLog('Sessão aberta: ' + (a.title || 'App'));
    }
    $('#btnCloseAll').onclick = () => { if(!confirm('Fechar todas as sessões abertas?')) return; $$('.session').forEach(s => s.remove()); updateDock(); toast('Todas as sessões fechadas', 'warn'); };

    /* ===================== Archetypes (Central Circle) ===================== */
    (function () {
      const archList = [
        'luxara.html',
        'rhea.html',
        'aion.html',
        'atlas.html',
        'nova.html',
        'genus.html',
        'lumine.html',
        'kaion.html',
        'kaos.html',
        'horus.html',
        'elysha.html'
      ];
      const select = document.getElementById('arch-select');
      const frame = document.getElementById('arch-frame');
      const fade = document.getElementById('arch-fadeCover');

      // Mapeamento de cores/gradientes por arquétipo.  Cada chave
      // corresponde ao nome do arquivo sem a extensão .html e define
      // um valor CSS (cor sólida ou gradiente) com opacidade baixa
      // para aplicar como overlay.  Ajuste as cores conforme o
      // significado simbólico de cada arquétipo.
      const ARCH_OVERLAYS = {
        luxara: 'rgba(181, 96, 255, 0.22)',  // roxo suave
        rhea:   'rgba(0, 209, 178, 0.22)',  // verde-água
        aion:   'rgba(255, 159, 67, 0.22)',  // laranja dourado
        atlas:  'rgba(64, 158, 255, 0.22)',  // azul celeste
        nova:   'rgba(255, 82, 177, 0.22)',  // rosa fúcsia
        genus:  'rgba(87, 207, 112, 0.22)',  // verde esmeralda
        lumine:'rgba(255, 213, 79, 0.22)',  // amarelo suave
        kaion:  'rgba(0, 191, 255, 0.22)',  // azul turquesa
        kaos:   'rgba(255, 77, 109, 0.22)', // vermelho vibrante
        horus:  'rgba(255, 195, 0, 0.22)',  // dourado
        elysha:'rgba(186, 130, 219, 0.22)', // lilás
        // valores padrão para quaisquer outros arquétipos
        default:'rgba(255, 255, 255, 0.0)'
      };

      // Aplica a cor/gradiente de overlay correspondente ao arquétipo
      function applyArchOverlay(name) {
        const key = (name || '').toLowerCase();
        const color = ARCH_OVERLAYS[key] || ARCH_OVERLAYS.default;
        document.documentElement.style.setProperty('--arch-overlay', color);
      }
      function populate() {
        select.innerHTML = '';
        archList.forEach(name => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          select.appendChild(opt);
        });
      }
      function setSrcByIndex(idx) {
        if(!archList.length) return;
        const n = (idx + archList.length) % archList.length;
        select.selectedIndex = n;
        const file = archList[n];
        frame.src = './archetypes/' + file;
        // Pronuncia o nome do arquétipo sempre que for selecionado
        try {
          const base = file.replace(/\.html$/i, '');
          speakArchetype(base);
        } catch (e) {}
        // Atualiza as informações da Home (cartões) quando o arquétipo muda
        try {
          updateHomeStatus();
        } catch (e) {}

        // Ajusta o overlay de cor para o arquétipo selecionado
        try {
          const base = file.replace(/\.html$/i, '');
          applyArchOverlay(base);
        } catch (e) {}
      }
      let current = 0;
      populate();
      if(archList.length) setSrcByIndex(0);
      document.getElementById('arch-prev').addEventListener('click', () => {
        current = (current - 1 + archList.length) % archList.length;
        fade.classList.add('show');
        setTimeout(() => {
          setSrcByIndex(current);
          setTimeout(() => fade.classList.remove('show'), 200);
        }, 140);
      });
      document.getElementById('arch-next').addEventListener('click', () => {
        current = (current + 1) % archList.length;
        fade.classList.add('show');
        setTimeout(() => {
          setSrcByIndex(current);
          setTimeout(() => fade.classList.remove('show'), 200);
        }, 140);
      });
      select.addEventListener('change', () => {
        current = select.selectedIndex;
        fade.classList.add('show');
        setTimeout(() => {
          setSrcByIndex(current);
          setTimeout(() => fade.classList.remove('show'), 200);
        }, 140);
      });
    })();

    /* ===================== Custom CSS & Voices: Event Handlers ===================== */
    // Aplicar CSS personalizado salvo no carregamento inicial
    try { applyCSS(); } catch (e) {}
    // Inicializar vozes na aba Brain
    try { initVoices(); } catch (e) {}
    // Inicializar ripple de áudio (modo que responde ao microfone)
    try { initAudioRipple(); } catch (e) {}
    // Exibir saudação inicial se aplicável
    try { welcome(); } catch (e) {}
    // Conectar botões de CSS personalizado
    const btnApplyCSS = document.getElementById('applyCSS');
    const btnClearCSS = document.getElementById('clearCSS');
    const btnDownloadCSS = document.getElementById('downloadCSS');
    if(btnApplyCSS) {
      btnApplyCSS.addEventListener('click', () => {
        const textarea = document.getElementById('cssCustom');
        const css = (textarea && textarea.value || '').trim();
        localStorage.setItem('infodose:cssCustom', css);
        applyCSS();
        toast('CSS aplicado', 'ok');
      });
    }
    if(btnClearCSS) {
      btnClearCSS.addEventListener('click', () => {
        localStorage.removeItem('infodose:cssCustom');
        const textarea = document.getElementById('cssCustom');
        if(textarea) textarea.value = '';
        applyCSS();
        toast('CSS removido', 'warn');
      });
    }
    if(btnDownloadCSS) {
      btnDownloadCSS.addEventListener('click', () => {
        const css = localStorage.getItem('infodose:cssCustom') || '';
        const blob = new Blob([css], { type: 'text/css' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'custom.css';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 500);
      });
    }

    /* ===================== Init ===================== */
    // Inicialize preferências de performance e voz e associe botões no Brain
    (function initDualPrefs(){
      const perfSel = document.getElementById('selPerf');
      const voiceSel = document.getElementById('selVoice');
      if(perfSel) perfSel.value = dualState.perf;
      if(voiceSel) voiceSel.value = dualState.voice;
      const perfBtn = document.getElementById('btnPerf');
      const voiceBtn = document.getElementById('btnVoice');
      if(perfBtn && perfSel) {
        perfBtn.addEventListener('click', () => {
          dualState.perf = perfSel.value;
          localStorage.setItem('hub.perf', dualState.perf);
          dualLog('Performance atualizada: ' + dualState.perf);
          toast('Performance atualizada', 'ok');
        });
      }
      // Ocultar seletor e botão de voz global: o mapeamento de vozes é gerenciado automaticamente.
      if(voiceSel) {
        const parent = voiceSel.parentElement;
        if(parent) parent.style.display = 'none';
      }
      if(voiceBtn) voiceBtn.style.display = 'none';
    })();
    $$('button').forEach(addRipple);

(function(){
  const $ = (q,r=document)=>r.querySelector(q);
  const LS = {
    get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
    set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},
    raw:(k)=>localStorage.getItem(k)||''
  };

  // Migrate old keys → canonical
  try{
    const themeKeys=['uno:theme','theme','infodose:theme','dual:theme'];
    let theme=null;
    for(const k of themeKeys){ const v=localStorage.getItem(k); if(v && !theme){ theme=v; } }
    if(theme){ localStorage.setItem('uno:theme', theme); }
    const bgKeys=['uno:bg','bg','background','infodose:bg','dual:bg'];
    let bg=null;
    for(const k of bgKeys){ const v=localStorage.getItem(k); if(v && !bg){ bg=v; } }
    if(bg){ localStorage.setItem('uno:bg', bg); }
  }catch{}

  
  // Also migrate old identity keys if needed (name/sk/model/training)
  try{
    const name = localStorage.getItem('infodose:userName') || localStorage.getItem('dual.name');
    if(name) localStorage.setItem('infodose:userName', name);
    const sk = localStorage.getItem('dual.keys.openrouter') || localStorage.getItem('infodose:sk');
    if(sk) localStorage.setItem('dual.keys.openrouter', sk);
    const model = localStorage.getItem('dual.openrouter.model') || localStorage.getItem('infodose:model');
    if(model) localStorage.setItem('dual.openrouter.model', model);
    const training = localStorage.getItem('dual.openrouter.training') || localStorage.getItem('infodose:training');
    if(training) localStorage.setItem('dual.openrouter.training', training);
  }catch{}
// Ensure BG container
  (function(){
    let bg=document.getElementById('custom-bg');
    if(!bg){
      bg=document.createElement('div');
      bg.id='custom-bg';
      bg.style.cssText='position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none';
      document.body.prepend(bg);
    }
  })();

  // No-flicker theme/bg applier
  function applyTheme_NoFlicker(forceSrc){
    const theme = LS.get('uno:theme','medium');
    if(theme==='default') delete document.body.dataset.theme;
    else document.body.dataset.theme = theme;

    const bgContainer = document.getElementById('custom-bg');
    if(!bgContainer) return;

    if(theme!=='custom'){
      if(bgContainer.firstChild) bgContainer.innerHTML='';
      return;
    }
    const data = forceSrc || LS.get('uno:bg','');
    if(!data){
      document.body.dataset.theme='medium';
      if(bgContainer.firstChild) bgContainer.innerHTML='';
      return;
    }
    const isVid = data.startsWith('data:video/');
    const cur = bgContainer.firstChild;
    if(cur){
      const sameType = (cur.tagName==='VIDEO' && isVid) || (cur.tagName==='IMG' && !isVid);
      if(sameType){
        if(cur.src !== data){ cur.src = data; }
        return;
      }
    }
    const el = document.createElement(isVid?'video':'img');
    el.src = data;
    if(isVid){ el.autoplay=true; el.loop=true; el.muted=true; el.playsInline=true; }
    el.style.width='100%'; el.style.height='100%'; el.style.objectFit='cover';
    if(cur){
      el.style.opacity='0';
      bgContainer.appendChild(el);
      requestAnimationFrame(()=>{
        el.style.transition='opacity .36s ease';
        el.style.opacity='1';
        setTimeout(()=>cur.remove(), 360);
      });
    }else{
      bgContainer.appendChild(el);
    }
  }

  // Wire Brain inputs if present
  document.addEventListener('DOMContentLoaded', ()=>{
    applyTheme_NoFlicker();
    const sel = document.getElementById('themeSelect');
    if(sel){
      sel.value = LS.get('uno:theme','medium');
      sel.addEventListener('change', ()=>{ LS.set('uno:theme', sel.value); applyTheme_NoFlicker(); });
    }
    const up = document.getElementById('bgUpload');
    if(up){
      up.addEventListener('change', (e)=>{
        const f = e.target.files && e.target.files[0];
        if(!f) return;
        const r = new FileReader();
        r.onload = ()=>{
          try{
            LS.set('uno:bg', r.result);
            LS.set('uno:theme','custom');
            if(sel) sel.value='custom';
            applyTheme_NoFlicker(r.result);
          }catch{}
        };
        r.readAsDataURL(f);
      });
    }
  });

  // ---- Archetype iframe fix (sandbox + path) ----
  (function(){
    const frame = document.getElementById('arch-frame') || document.querySelector('iframe#archetype, iframe[data-arch]');
    if(!frame) return;
    // ensure sandbox allows same-origin (for CSS, fonts, and localStorage used by archetypes)
    const want = 'allow-scripts allow-same-origin';
    try{
      const cur = (frame.getAttribute('sandbox')||'').toLowerCase();
      if(!/allow-same-origin/.test(cur)){
        frame.setAttribute('sandbox', (cur + ' ' + want).trim());
      }
    }catch{}
    // If src is only a filename (e.g., atlas.html), prefix with ./archetypes/
    try{
      const src = frame.getAttribute('src')||'';
      if(src && !/^\w+:|^\//.test(src) && !src.startsWith('./archetypes/')){
        frame.setAttribute('src', './archetypes/' + src.replace(/^\.\/?/,'').replace(/^archetypes\//,''));
      }
    }catch{}
    // Hook a select#arch-select if exists
    const sel = document.getElementById('arch-select');
    if(sel){
      sel.addEventListener('change', ()=>{
        const file = sel.value || '';
        if(!file) return;
        const clean = file.replace(/\.html$/i,'') + '.html';
        const newSrc = './archetypes/' + clean;
        const cur = frame.getAttribute('src')||'';
        if(cur!==newSrc){
          frame.src = newSrc;
        }
      });
    }
  })();
})();

(function(){
  const $=(q,r=document)=>r.querySelector(q);
  const $$=(q,r=document)=>Array.from(r.querySelectorAll(q));
  const LS={raw:(k)=>localStorage.getItem(k)||''};
  function utf8Bytes(s){try{return new Blob([s]).size}catch(e){return (new TextEncoder()).encode(s).length}}
  function fmtBytes(n){return n<1024? n+' B' : n<1048576? (n/1024).toFixed(1)+' KB' : (n/1048576).toFixed(2)+' MB'}
  function lsSize(){let t=0,h=0;const HEAVY=50*1024; for(const k of Object.keys(localStorage)){const v=localStorage.getItem(k)||''; const b=utf8Bytes(k)+utf8Bytes(v); t+=b; if(b>HEAVY) h++;} return {t,h}}
  function estimateUsage(el){ if(navigator.storage?.estimate){ navigator.storage.estimate().then(({usage,quota})=>{ el.textContent=(usage&&quota)?`${fmtBytes(usage)} / ${fmtBytes(quota)}`:'—' }); } else { el.textContent='—'; } }

  const Toast={
    init(){ this.host = $('#lsx-toastBox') || document.body.appendChild(Object.assign(document.createElement('div'),{id:'lsx-toastBox'})); },
    show(msg,type='ok',ms=1600){ if(!this.host) this.init(); const el=$('#tpl-lsx-toast').content.firstElementChild.cloneNode(true); if(type==='warn') el.style.background='linear-gradient(90deg,#2f261b,#3c2d12)'; if(type==='err') el.style.background='linear-gradient(90deg,#2f1b1b,#3c1212)'; el.textContent=msg; this.host.appendChild(el); setTimeout(()=>{ el.style.opacity=.0; el.style.transform='translateY(6px)'; setTimeout(()=>el.remove(),220); }, ms); }
  };

  const Logger={
    init(){ const host = $('#lsx-logger') || document.body.appendChild(Object.assign(document.createElement('div'),{id:'lsx-logger'})); host.innerHTML=''; host.appendChild($('#tpl-lsx-logger').content.cloneNode(true)); $('#lsx-log-close').addEventListener('click',()=> host.style.display='none'); this.host=host; this.pre=$('#lsx-logs'); },
    push(m){ if(!this.pre) this.init(); const line='['+new Date().toLocaleTimeString()+'] '+m; const arr=(this.pre.textContent||'').split('\\n'); arr.unshift(line); this.pre.textContent=arr.slice(0,120).join('\\n'); this.host.style.display='block'; }
  };

  const DualLS={
    open(){ const p=$('#lsx-panel'); if(p){ p.style.display='block'; this.render(); this.refresh(); }},
    close(){ const p=$('#lsx-panel'); if(p){ p.style.display='none'; }},
    toggle(){ const p=$('#lsx-panel'); if(!p) return; p.style.display = (p.style.display==='block'?'none':'block'); if(p.style.display==='block'){ this.render($('#lsx-search').value); this.refresh(); }},
    initPanel({mount='#lsx-mount'}={}){
      const host=$(mount)||document.body; if(!$('#lsx-panel')){ host.appendChild($('#tpl-lsx-panel').content.cloneNode(true));
        // binds
        $('#lsx-hide').addEventListener('click',()=> this.close());
        $('#lsx-refresh').addEventListener('click',()=>{ this.render($('#lsx-search').value); this.refresh(); });
        $('#lsx-search').addEventListener('input',ev=> this.render(ev.target.value));
        $('#lsx-add').addEventListener('click',()=>{ const k=$('#lsx-new-k').value.trim(), v=$('#lsx-new-v').value; if(!k) return; if(localStorage.getItem(k)&&!confirm('Sobrescrever?')) return; localStorage.setItem(k,v); $('#lsx-new-k').value=''; $('#lsx-new-v').value=''; this.render($('#lsx-search').value); this.refresh(); Toast.show('Chave salva','ok'); Logger.push('LS: gravou '+k); });
        $('#lsx-export').addEventListener('click',()=>{ const dump={}; Object.keys(localStorage).forEach(k=> dump[k]=localStorage.getItem(k)); const blob=new Blob([JSON.stringify(dump,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ls-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),400); Toast.show('Backup exportado'); Logger.push('LS: exportou backup'); });
        const impBtn=$('#lsx-import-btn'), impInput=$('#lsx-import'); impBtn.addEventListener('click',()=> impInput.click()); impInput.addEventListener('change',(ev)=>{ const f=ev.target.files&&ev.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const obj=JSON.parse(String(r.result||'')); Object.keys(obj).forEach(k=> localStorage.setItem(k,String(obj[k]))); this.render($('#lsx-search').value); this.refresh(); Toast.show('Importação concluída'); Logger.push('LS: importou backup'); }catch(e){ alert('JSON inválido.'); } }; r.readAsText(f); ev.target.value=''; });
        $('#lsx-clear-all').addEventListener('click',()=>{ if(!confirm('Backup automático será criado. Confirmar LIMPAR LocalStorage?')) return; const snap={}; Object.keys(localStorage).forEach(k=> snap[k]=localStorage.getItem(k)); const stamp=new Date().toISOString().replace(/[:.]/g,'-'); try{ localStorage.setItem('ls:backup:'+stamp, JSON.stringify(snap)); }catch(e){} const blob=new Blob([JSON.stringify(snap,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ls-backup-'+stamp+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); localStorage.clear(); this.render(''); this.refresh(); Toast.show('LocalStorage limpo','warn'); Logger.push('LS: limpou tudo'); });
        $('#lsx-clear-idb').addEventListener('click', async()=>{ if(!confirm('Limpar TODOS os bancos IndexedDB deste domínio?')) return; try{ if(indexedDB.databases){ const dbs=await indexedDB.databases(); await Promise.all(dbs.map(d=> new Promise(res=>{ const name=d.name; if(!name) return res(); const req=indexedDB.deleteDatabase(name); req.onsuccess=req.onerror=req.onblocked=()=>res(); }))); alert('IndexedDB limpo (quando suportado).'); } else alert('Navegador não expõe indexedDB.databases().'); }catch(e){ alert('Falha ao limpar IndexedDB: '+e); } this.refresh(); Logger.push('LS: solicitou limpeza IDB'); });
      }
      this.wireHeader();
    },
    wireHeader(){
      const self=this;
      const say=(t)=>{ try{ if(typeof speakWithActiveArch==='function') speakWithActiveArch(t); }catch(e){} };
      document.getElementById('btnLS') && document.getElementById('btnLS').addEventListener('click',()=> self.toggle());
      document.getElementById('btnToggleLocal') && document.getElementById('btnToggleLocal').addEventListener('click',()=>{ const state=(localStorage.getItem('uno:showLocal')==='1'); localStorage.setItem('uno:showLocal', state?'0':'1'); Toast.show(state?'Mostrando todos':'Mostrando Locais'); Logger.push('Header: toggle Locais = '+(!state)); say('Ok'); });
      // Removido listener genérico que apenas falava “Ok” para vários botões
      // (saveName, saveSK, applyCSS, clearCSS, btnPerf, btnVoice, btnImport).
      // Os botões já possuem manipuladores específicos definidos em outras
      // partes do código (por exemplo, em initBrain), portanto não precisam
      // de outro listener aqui. Caso deseje feedback de voz, chame say()
      // dentro dessas funções específicas.
    },
    render(filter=''){
      const grid=$('#lsx-grid'); if(!grid) return;
      const f=(filter||'').toLowerCase(); grid.innerHTML='';
      const groups={}; Object.keys(localStorage).sort().forEach(k=>{ const v=localStorage.getItem(k)||''; if(f && !(k.toLowerCase().includes(f)||v.toLowerCase().includes(f))) return; const grp=k.includes(':')?k.split(':')[0]:(k.includes('.')?k.split('.')[0]:'geral'); (groups[grp] ||= []).push({k,v}); });
      const ordered=Object.keys(groups).sort((a,b)=>a.localeCompare(b));
      const headHTML='<div>Chave</div><div>Valor</div><div>Ações</div>';
      ordered.forEach(name=>{ const det=document.createElement('details'); det.className='lsx-group'; det.open=true; const sum=document.createElement('summary'); sum.innerHTML=`<span class="chev">›</span><strong>${name}</strong><span class="lsx-badge">${groups[name].length}</span>`; det.appendChild(sum); const body=document.createElement('div'); body.className='lsx-body-inner'; const head=document.createElement('div'); head.className='lsx-head'; head.innerHTML=headHTML; body.appendChild(head); groups[name].forEach(({k,v})=> body.appendChild(makeRow(k,v))); det.appendChild(body); grid.appendChild(det); });
      function makeRow(k,vRaw){ const row=document.createElement('div'); row.className='lsx-row'; const colK=document.createElement('div'); colK.className='lsx-k'; colK.textContent=k; const colV=document.createElement('div'); colV.className='lsx-v'; const prev=document.createElement('div'); prev.className='lsx-preview'; prev.textContent=vRaw.length>240?(vRaw.slice(0,240)+'…'):vRaw; const expand=document.createElement('div'); expand.className='lsx-expand'; const ta=document.createElement('textarea'); ta.value=vRaw; expand.appendChild(ta); colV.append(prev,expand); const colA=document.createElement('div'); colA.className='lsx-a'; const mk=(title,cls,cb,svg)=>{const b=document.createElement('button'); b.className='ic-btn'+(cls?(' '+cls):''); b.title=title; b.innerHTML=svg||title; b.onclick=cb; return b;}; const Bx=mk('expandir','',()=>{ expand.style.display=expand.style.display==='block'?'none':'block'; },'<svg width="18" height="18" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="2" fill="currentColor"/></svg>'); const Bc=mk('copiar','',()=> navigator.clipboard.writeText(vRaw),'<svg width="18" height="18" viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" fill="currentColor"/></svg>'); const Bs=mk('salvar','ok',()=>{ const nv=expand.style.display==='block'? ta.value : vRaw; localStorage.setItem(k,nv); prev.textContent=nv.length>240?(nv.slice(0,240)+'…'):nv; DualLS.refresh(); Toast.show('Salvo'); Logger.push('LS: salvou '+k); },'<svg width="18" height="18" viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14h18V7l-4-4z" fill="currentColor"/></svg>'); const Bd=mk('apagar','warn',()=>{ if(!confirm('Apagar “'+k+'”?')) return; localStorage.removeItem(k); row.remove(); DualLS.refresh(); Toast.show('Apagado','warn'); Logger.push('LS: apagou '+k); },'<svg width="18" height="18" viewBox="0 0 24 24"><path d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 7h2v8h-2v-8zm4 0h2v8h-2v-8z" fill="currentColor"/></svg>'); colA.append(Bx,Bc,Bs,Bd); row.append(colK,colV,colA); return row; }
    },
    refresh(){ const {t,h}=lsSize(); $('#lsx-st-keys').textContent=String(localStorage.length); $('#lsx-st-bytes').textContent=fmtBytes(t); $('#lsx-st-heavy').textContent=String(h); estimateUsage($('#lsx-st-usage')); }
  };
  // Expor sob o mesmo nome para compat com seus binds existentes
  window.DualLS = DualLS;
  window.DualToast = Toast;
  window.DualLSLogger = Logger;

  document.addEventListener('DOMContentLoaded',()=>{ Logger.init(); Toast.init(); DualLS.initPanel({ mount:'#lsx-mount' }); if(location.hash==='#lsx'){ DualLS.open(); } });
})();

(function(){
  const $ = (q,r=document)=>r.querySelector(q);
  const $$ = (q,r=document)=>Array.from(r.querySelectorAll(q));

  function sayLS(text){
    try{
      if(typeof speakWithActiveArch === 'function'){
        speakWithActiveArch(text);
      }else if(window.speechSynthesis){
        const u = new SpeechSynthesisUtterance(text);
        const vs = speechSynthesis.getVoices();
        const v = vs.find(v=>v.lang && (v.lang.startsWith('pt')||v.lang.startsWith('en'))) || vs[0];
        if(v) u.voice = v;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
    }catch(e){}
  }

  // Patch DualLS open/close/toggle to speak
  function patchDualLS(){
    if(!window.DualLS) return;
    const origOpen = window.DualLS.open?.bind(window.DualLS);
    const origClose = window.DualLS.close?.bind(window.DualLS);
    const origToggle = window.DualLS.toggle?.bind(window.DualLS);

    if(origOpen){
      window.DualLS.open = function(){
        const r = origOpen?.();
        sayLS('Local Storage aberto');
        return r;
      };
    }
    if(origClose){
      window.DualLS.close = function(){
        sayLS('Local Storage fechado');
        return origClose?.();
      };
    }
    if(origToggle){
      window.DualLS.toggle = function(){
        const p = $('#lsx-panel');
        const willOpen = !(p && p.style.display==='block');
        const r = origToggle?.();
        sayLS(willOpen ? 'Local Storage aberto' : 'Local Storage fechado');
        return r;
      };
    }
  }

  // Add listeners to LSX panel controls (namespaced UI)
  function wireLSX(){
    const map = [
      ['#lsx-add',        ()=>{
        const k = ($('#lsx-new-k')?.value || '').trim();
        sayLS(k ? `Chave ${k} salva no Local Storage` : 'Chave salva no Local Storage');
      }],
      ['#lsx-export',     ()=> sayLS('Backup exportado')],
      ['#lsx-import-btn', ()=> sayLS('Importar backup. Selecione o arquivo')],
      ['#lsx-clear-all',  ()=> sayLS('Limpar Local Storage. Confirme sua escolha')],
      ['#lsx-clear-idb',  ()=> sayLS('Limpar IndexedDB. Confirme sua escolha')],
      ['#lsx-refresh',    ()=> sayLS('Atualizando visão do Local Storage')],
      ['#lsx-hide',       ()=> sayLS('Fechando painel do Local Storage')],
    ];
    map.forEach(([sel,fn])=>{
      const el = $(sel);
      if(el) el.addEventListener('click', fn, {passive:true});
    });

    // Reflect row-level actions via logger hook (save/delete etc.)
    if(window.DualLSLogger){
      const origPush = window.DualLSLogger.push?.bind(window.DualLSLogger);
      if(origPush){
        window.DualLSLogger.push = function(msg){
          try{
            const m = String(msg||'').toLowerCase();
            if(m.includes('ls: salvou'))      sayLS('Chave salva');
            if(m.includes('ls: apagou'))      sayLS('Chave apagada');
            if(m.includes('limpou tudo'))     sayLS('Local Storage limpo');
            if(m.includes('importou backup')) sayLS('Backup importado com sucesso');
            if(m.includes('exportou backup')) sayLS('Backup exportado com sucesso');
          }catch(e){}
          return origPush(msg);
        };
      }
    }
  }

  // Add listeners to legacy LS panel controls (if present)
  function wireLegacyLS(){
    const map = [
      ['#ls-add',        ()=>{
        const k = ($('#ls-new-k')?.value || '').trim();
        sayLS(k ? `Chave ${k} salva no Local Storage` : 'Chave salva no Local Storage');
      }],
      ['#ls-export',     ()=> sayLS('Backup exportado')],
      ['#ls-import-btn', ()=> sayLS('Importar backup. Selecione o arquivo')],
      ['#ls-clear-all',  ()=> sayLS('Limpar Local Storage. Confirme sua escolha')],
      ['#ls-clear-idb',  ()=> sayLS('Limpar IndexedDB. Confirme sua escolha')],
      ['#ls-refresh',    ()=> sayLS('Atualizando visão do Local Storage')],
      ['#ls-hide',       ()=> sayLS('Fechando painel do Local Storage')],
      ['#btnLS',         ()=> sayLS('Abrindo painel do Local Storage')],
    ];
    map.forEach(([sel,fn])=>{
      const el = $(sel);
      if(el) el.addEventListener('click', fn, {passive:true});
    });
  }

  // Theme & background announcements
  function wireThemeBG(){
    const themeSel = $('#themeSelect');
    if(themeSel){
      themeSel.addEventListener('change', ()=>{
        const v = themeSel.value;
        const label = ({default:'padrão', medium:'cinza médio', custom:'personalizado'}[v]||v);
        sayLS(`Tema ${label} aplicado`);
      }, {passive:true});
    }
    const bgInput = $('#bgUpload');
    if(bgInput){
      bgInput.addEventListener('change', ()=>{
        sayLS('Fundo personalizado salvo');
      }, {passive:true});
    }
  }

  // CSS custom announcements
  function wireCSS(){
    const apply = $('#applyCSS');
    const clear = $('#clearCSS');
    const down  = $('#downloadCSS');
    if(apply)  apply.addEventListener('click', ()=> sayLS('CSS aplicado'), {passive:true});
    if(clear)  clear.addEventListener('click', ()=> sayLS('CSS removido'), {passive:true});
    if(down)   down .addEventListener('click', ()=> sayLS('Baixando CSS'), {passive:true});
  }

  // Brain basic saves (name, SK, perf/voice)
  function wireBrain(){
    // Não adiciona ouvintes genéricos aqui. Qualquer feedback de voz deve ser
    // definido nas funções específicas (por exemplo, dentro de initDualPrefs()
    // ou handlers individuais). Adicionar ouvintes genéricos causava
    // sobreposição de cliques e reprodução de voz incorreta.
  }

  // Speak when LS header "LS" badge is clicked
  function wireHeaderLS(){
    const btn = $('#btnLS');
    if(btn){
      // Apenas abre o painel do LocalStorage sem feedback de voz para evitar
      // interpretações erradas de cliques. DualLS.toggle é chamado em outro local.
      btn.addEventListener('click', ()=>{}, {passive:true});
    }
  }

  // Init once DOM is ready
  document.addEventListener('DOMContentLoaded', ()=>{
    patchDualLS();
    wireLSX();
    wireLegacyLS();
    wireThemeBG();
    wireCSS();
    wireBrain();
    wireHeaderLS();
  });
})();

(function(){
  const $ = (q,r=document)=>r.querySelector(q);
  const $$ = (q,r=document)=>Array.from(r.querySelectorAll(q));

  function ensureCompactButton(panelId, actionsId, ids){
    const panel = $(panelId);
    const actions = $(actionsId);
    if(!panel || !actions) return;

    // Create toggle button (once)
    let btn = actions.querySelector('.ls-compact-toggle');
    if(!btn){
      btn = document.createElement('button');
      btn.className = 'ls-compact-toggle';
      btn.type = 'button';
      btn.id = ids.toggleId;
      btn.title = 'Alternar modo compacto do painel LS';
      btn.textContent = 'Compactar';
      actions.appendChild(btn);
    }

    // Initial state: compact ON (to liberar espaço)
    if(!panel.classList.contains('ls-compact')){
      panel.classList.add('ls-compact');
    }

    // Toggle logic
    btn.addEventListener('click', ()=>{
      const compact = panel.classList.toggle('ls-compact');
      btn.textContent = compact ? 'Expandir' : 'Compactar';
      // Optional: announce via TTS if available
      try{
        if(typeof speakWithActiveArch === 'function'){
          speakWithActiveArch(compact ? 'Modo compacto ativado' : 'Modo compacto desativado');
        }
      }catch(e){}
      // After toggling, recompute list height
      setTimeout(resizeListArea, 10);
    }, {passive:true});
  }

  function pickListCandidate(root){
    const sels = ['#lsx-list','#ls-list','#ls-keys','.ls-list','.ls-keys','.ls-data'];
    for(const s of sels){
      const el = root.querySelector(s);
      if(el) return el;
    }
    return null;
  }

  function resizeListArea(){
    const panels = ['#lsx-panel','#ls-panel'];
    panels.forEach(pid=>{
      const p = $(pid);
      if(!p) return;
      const actions = p.querySelector('#lsx-actions, #ls-actions, #ls-header, #lsx-header');
      const list = pickListCandidate(p);
      if(!list) return;
      const rect = p.getBoundingClientRect();
      const topY = actions ? actions.getBoundingClientRect().bottom : rect.top;
      const available = Math.max(160, window.innerHeight - topY - 24);
      list.style.maxHeight = available + 'px';
      list.style.overflow = 'auto';
    });
  }

  // Wire up both legacy and namespaced panels
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureCompactButton('#lsx-panel', '#lsx-actions', {toggleId:'lsx-compact-toggle'});
    ensureCompactButton('#ls-panel',  '#ls-actions',  {toggleId:'ls-compact-toggle'});
    resizeListArea();
    window.addEventListener('resize', resizeListArea);
  });
})();

(function(){
  // ---------- Speech de-dup & filter ----------
  const _oldSpeak = (typeof speakWithActiveArch === 'function') ? speakWithActiveArch : null;
  let _lastUtter = { text: '', t: 0 };
  function shouldSpeak(text){
    const now = Date.now();
    // Normalize to lower-case & trim
    const norm = String(text||'').trim().toLowerCase();
    // Drop empty or very short
    if(!norm || norm.length < 2) return false;
    // Drop repeats within 1200ms
    if (norm === (_lastUtter.text||'') && (now - _lastUtter.t) < 1200) return false;
    // If it's about Local Storage panel, prefer "abrindo/fechando" phrasing only.
    if(/local storage/.test(norm)){
      if(/aberto|fechado/.test(norm) && !/abrindo|fechando/.test(norm)) return false;
    }
    _lastUtter = { text: norm, t: now };
    return true;
  }
  window.speakWithActiveArch = function(text){
    try{
      if(!shouldSpeak(text)) return;
      if(_oldSpeak) return _oldSpeak(text);
      // Minimal fallback if original doesn't exist
      if(window.speechSynthesis){
        const u = new SpeechSynthesisUtterance(String(text));
        const vs = speechSynthesis.getVoices();
        const v = vs.find(v=>v.lang && (v.lang.startsWith('pt')||v.lang.startsWith('es'))) || vs[0];
        if(v) u.voice = v;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
    }catch(e){}
  };

  // ---------- DualLS patches: say just once ("Abrindo..." / "Fechando...") ----------
  function patchDualLS_A11y(){
    const LSAPI = window.DualLS;
    if(!LSAPI) return;
    const oOpen = LSAPI.open?.bind(LSAPI);
    const oClose = LSAPI.close?.bind(LSAPI);
    const oToggle = LSAPI.toggle?.bind(LSAPI);
    if(oOpen){
      LSAPI.open = function(){
        try{ speakWithActiveArch('Abrindo painel do Local Storage'); }catch(e){}
        return oOpen();
      };
    }
    if(oClose){
      LSAPI.close = function(){
        try{ speakWithActiveArch('Fechando painel do Local Storage'); }catch(e){}
        return oClose();
      };
    }
    if(oToggle){
      LSAPI.toggle = function(){
        const p = document.querySelector('#lsx-panel');
        const willOpen = !(p && p.style.display==='block');
        try{ speakWithActiveArch(willOpen ? 'Abrindo painel do Local Storage' : 'Fechando painel do Local Storage'); }catch(e){}
        return oToggle();
      };
    }
  }

  // ---------- Persist Compact Mode for LS panels ----------
  function persistCompactMode(){
    const KEY = 'ls:compact:on';
    const lsPanel = document.querySelector('#ls-panel');
    const lsxPanel = document.querySelector('#lsx-panel');
    const desired = localStorage.getItem(KEY) === '1';
    [lsPanel, lsxPanel].forEach(p => {
      if(!p) return;
      if(desired) p.classList.add('ls-compact'); else p.classList.remove('ls-compact');
      const btn = p.querySelector('.ls-compact-toggle');
      if(btn && !btn._boundPersist){
        btn._boundPersist = true;
        btn.addEventListener('click', ()=>{
          const on = p.classList.contains('ls-compact');
          localStorage.setItem(KEY, on ? '1' : '0');
        });
      }
    });
  }

  // ---------- PowerAI: unify chat calls & inject Role/System training ----------
  // Reads optional DXT training from localStorage key 'dual.openrouter.training' ({name,data:dataURL})
  async function loadDXTTraining(){
  try{
    const raw = localStorage.getItem('dual.openrouter.training');
    if(!raw) return '';
    const obj = JSON.parse(raw);
    if(!obj || !obj.data) return '';
    const base64 = String(obj.data).split(',')[1] || '';
    if(!base64) return '';
    const bin = atob(base64);
    // Convert binary string to UTF-8 text safely
    let text = '';
    try {
      const bytes = new Uint8Array(Array.from(bin, c => c.charCodeAt(0)));
      text = new TextDecoder('utf-8', {fatal:false}).decode(bytes);
    } catch(e){
      text = bin;
    }
    // Limit to ~64KB to avoid huge prompts
    return text.length > 64*1024 ? text.slice(0, 64*1024) : text;
  }catch(e){ return ''; }
}

  function activeArchetypePair(){
    // Primary = selected archetype in #arch-select
    let primary = 'Dual';
    try{
      const sel = document.getElementById('arch-select');
      if(sel && sel.value){
        primary = sel.value.replace(/\.html$/i,'').toLowerCase();
      }
    }catch{}
    // Secondary: use the custom Dual name if provided, otherwise fallback
    let secondary = 'Dual Infodose';
    try {
      const dn = (localStorage.getItem('dual.infodoseName') || '').trim();
      if(dn) secondary = `${dn} Dual Infodose`;
    } catch {}
    const cap = s => (s||'Dual').charAt(0).toUpperCase()+s.slice(1).toLowerCase();
    return [cap(primary), cap(secondary)];
  }

  const oldSend = window.sendAIMessage;
  window.PowerAI = {
    async chat(userContent, sk, model){
      const [archA, archB] = activeArchetypePair();
      // Use descrição do arquétipo primário e nome do usuário para enriquecer o prompt
      const descA = getArchDesc(archA.toLowerCase());
      const userName = getUserName();
      const sysIdentity =
        `Você é o Assistente Dual Infodose — codinome "${archB}".` +
        `\nArquétipo primário: ${archA}${descA ? ' – ' + descA : ''}.` +
        `\nConectado simultaneamente aos arquétipos ${archA} e ${archB}.` +
        (userName ? `\nVocê conversa com ${userName}.` : '') +
        `\nFale sempre em português do Brasil, direto e gentil.` +
        `\nUse o contexto do app (UNO • Brain • Stack • Apps) quando útil.`;

      let training = await loadDXTTraining();
      // Normalize training to text (it may be JSON string)
      if(training && training.trim().startsWith('{')){
        try{
          const j = JSON.parse(training);
          training = (j.system || j.prompt || JSON.stringify(j));
        }catch{}
      }
      const sysTraining = training ? `# Treinamento DXT\n${training}` : '';

      const payload = {
        model: model,
        messages: [
          { role: 'system', content: sysIdentity + (sysTraining? '\n\n' + sysTraining : '') },
          { role: 'user', content: String(userContent||'') }
        ],
        max_tokens: 350,
        temperature: 0.7
      };

      const url = 'https://openrouter.ai/api/v1/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sk}`
        },
        body: JSON.stringify(payload)
      });
      if(!res.ok){
        throw new Error('Erro na API: ' + res.status);
      }
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || '';
      return reply;
    }
  };

  // Override legacy sendAIMessage to call PowerAI
  if(typeof oldSend === 'function'){
    window.sendAIMessage = async function(content, sk, model){
      return await window.PowerAI.chat(content, sk, model);
    };
  }

  // After DOM ready, run patches
  document.addEventListener('DOMContentLoaded', ()=>{
    patchDualLS_A11y();
    persistCompactMode();
    // Re-apply persist on panel (if it was not in the DOM at first render)
    setTimeout(persistCompactMode, 500);
  });
})();

// === TTS Navegação: toggle no Brain (sem editar código existente) ======================
(function(){
  const LS_KEY = 'uno:tts.nav'; // 'on' | 'off'
  function getNavTTS(){ return (localStorage.getItem(LS_KEY) || 'on') !== 'off'; }
  function setNavTTS(on){ localStorage.setItem(LS_KEY, on ? 'on' : 'off'); updateBtn(); }

  // Monkey-patch: suprimir speak() quando em contexto de navegação e toggle OFF
  function patchSpeakAndNav(){
    const origSpeak = window.speak;
    if (origSpeak && !origSpeak.__patchedForNavTTS){
      const wrapped = function(text, opts){
        try{
          if (window._navContext === true && !getNavTTS()){
            // bloqueia falas de navegação
            return;
          }
        }catch(e){}
        return origSpeak.apply(this, arguments);
      };
      wrapped.__patchedForNavTTS = true;
      window.speak = wrapped;
    }
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav.__patchedForNavTTS){
      const wrappedNav = function(){
        window._navContext = true;
        try { return origNav.apply(this, arguments); }
        finally { window._navContext = false; }
      };
      wrappedNav.__patchedForNavTTS = true;
      window.nav = wrappedNav;
    }
  }

  // criar UI: botão pequeno ON/OFF
  let btn;
  function updateBtn(){
    if(!btn) return;
    const on = getNavTTS();
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'TTS Nav: ON' : 'TTS Nav: OFF';
    btn.classList.toggle('on', on);
  }

  function makeButton(){
    btn = document.createElement('button');
    btn.id = 'btnTTSNavToggle';
    btn.type = 'button';
    btn.className = 'btn-ttsnav';
    btn.title = 'Alternar TTS de navegação';
    btn.addEventListener('click', ()=> setNavTTS(!getNavTTS()));
    updateBtn();
    return btn;
  }

  function mountButton(){
    const targets = [
      '#brain .tools', '#brain .header', '#brain',
      '#brainPanel', '#brain-header', '#brain-tools',
      '#lsx-actions', '#lsx-panel .header',
      '#header .right', '#header .tools', '#header'
    ];
    const el = targets.map(q=>document.querySelector(q)).find(Boolean) || document.body;
    el.appendChild(makeButton());
  }

  function addStyles(){
    const css = document.createElement('style');
    css.textContent = `
      .btn-ttsnav{
        font: 500 11px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif;
        padding: 6px 8px;
        border-radius: 999px;
        border: 1px solid var(--line, #2a2f39);
        background: rgba(255,255,255,0.04);
        color: var(--fg, #e7ecf5);
        margin-left: 8px;
        vertical-align: middle;
        cursor: pointer;
        opacity: 0.9;
        transition: box-shadow .2s var(--ease), opacity .2s var(--ease), transform .08s var(--ease);
      }
      .btn-ttsnav:hover{ opacity:1; }
      .btn-ttsnav:active{ transform: translateY(1px); }
      .btn-ttsnav.on{
        box-shadow: 0 0 0 2px rgba(0,255,170,.2), 0 0 14px rgba(0,255,170,.25);
        background: radial-gradient(100% 100% at 50% 0%, rgba(0,255,170,.18), rgba(0,0,0,0));
        border-color: rgba(0,255,170,.35);
      }
      @media (max-width: 420px){
        .btn-ttsnav{ padding: 5px 7px; font-size: 10px; }
      }
    `;
    document.head.appendChild(css);
  }

  function init(){
    try{ patchSpeakAndNav(); }catch(e){}
    addStyles();
    mountButton();
    // Observa mudanças externas no localStorage e reflete no botão
    window.addEventListener('storage', (ev)=>{
      if(ev.key === LS_KEY) updateBtn();
    });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();
})();

// PATCH: LS/LSX keep-open + mover botões soltos pro header de ações
(function(){
  const $=(q,r=document)=>r.querySelector(q);
  function keepOpen(ev){
    try{
      ev && ev.preventDefault && ev.preventDefault();
      ev && ev.stopPropagation && ev.stopPropagation();
      const p = $('#lsx-panel') || $('#ls-panel');
      if(p) p.style.display='block';
    }catch(e){}
  }
  function bindKeep(sel){
    const el = $(sel);
    if(!el) return;
    // avoid form submit or anchor navigation
    if(el.tagName==='BUTTON') el.type='button';
    if(el.tagName==='A') el.removeAttribute('href');
    el.addEventListener('click', keepOpen, true);
  }
  function moveIntoActions(panelSel, actionsSel, ids){
    const panel=$(panelSel), actions=$(actionsSel);
    if(!panel || !actions) return;
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(el && !actions.contains(el)){
        try{ actions.appendChild(el); }catch(e){}
      }
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    const ids = ['lsx-refresh','lsx-export','lsx-import-btn','lsx-clear-all','lsx-clear-idb','lsx-hide','ls-refresh','ls-export','ls-import-btn','ls-clear-all','ls-clear-idb','ls-hide'];
    ids.forEach(id=> bindKeep('#'+id));
    moveIntoActions('#lsx-panel','#lsx-actions', ids);
    moveIntoActions('#ls-panel','#ls-actions', ids);
  });
})();

// PATCH: busy-guard + voice-guard + timeout(20s) + timer + AbortController
(function(){
  // busy guard
  if(typeof window.handleUserMessage==='function' && !window.__patchedHandleGuard){
    const __origHandle = window.handleUserMessage;
    let __busy = false;
    window.__chatBusy = ()=>__busy;
    window.handleUserMessage = async function(){
      if(__busy){ try{ window.toast && toast('Aguarde a resposta terminar','warn'); }catch(e){} return; }
      __busy = true;
      try { return await __origHandle.apply(this, arguments); }
      finally { __busy = false; }
    };
    window.__patchedHandleGuard = true;
  }
  // voice guard
  document.addEventListener('DOMContentLoaded', function(){
    const vb = document.getElementById('homeVoiceBtn');
    if(vb && !vb.__guarded){
      const old = vb.onclick;
      vb.addEventListener('click', function(ev){
        if(window.__chatBusy && window.__chatBusy()){
          ev.preventDefault(); ev.stopPropagation();
          try{ speakWithActiveArch('Aguarde o pulso anterior finalizar.'); }catch(e){}
          return false;
        }
        if(typeof old==='function') return old.call(this, ev);
      }, true);
      vb.__guarded = true;
    }
  });
  // timeout + abort
  const TIMEOUT_MS = 20000;
  function timeoutPromise(ms){ return new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout')), ms)); }
  if(typeof window.sendAIMessage==='function' && !window.__wrappedSendTimeoutSignal){
    const __origSend = window.sendAIMessage;
    window.sendAIMessage = async function(){
      // Inject AbortSignal as last arg options if possible
      try{
        window.__activeSendController?.abort?.('superseded');
        window.__activeSendController = new AbortController();
        const args = Array.from(arguments);
        const last = args[args.length-1];
        if(last && typeof last==='object' && !Array.isArray(last)){
          if(!('signal' in last)) last.signal = window.__activeSendController.signal;
        } else {
          args.push({ signal: window.__activeSendController.signal });
        }
        const p = __origSend.apply(this, args);
        return await Promise.race([p, timeoutPromise(TIMEOUT_MS)]);
      }finally{ /* noop */ }
    };
    window.__wrappedSendTimeoutSignal = true;
    window.addEventListener('unhandledrejection', function(ev){
      const msg = (ev && ev.reason && (ev.reason.message||ev.reason)) || '';
      if(String(msg).toLowerCase().includes('timeout')){
        try{ window.__activeSendController && window.__activeSendController.abort('timeout'); }catch(e){}
        try{ window.toast && toast('Tempo esgotado (20s). Tente novamente.','warn'); }catch(e){}
        try{ window.speakWithActiveArch && speakWithActiveArch('Tempo esgotado. Reenvie quando quiser.'); }catch(e){}
      }
    });
  }
  // button timer
  function findSendBtn(){ return document.querySelector('#homeInputForm button[type="submit"]'); }
  function startBtnTimer(){
    const btn = findSendBtn(); if(!btn) return {stop:()=>{}};
    const original = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', original);
    const t0 = performance.now();
    const id = setInterval(()=>{
      const s = ((performance.now()-t0)/1000);
      btn.textContent = original + ' · ⏱ ' + (s>=10? s.toFixed(0): s.toFixed(1)) + 's';
    }, 120);
    return { stop(){ clearInterval(id); btn.textContent = btn.getAttribute('data-label') || 'Enviar'; } };
  }
  // attach around text submit
  document.addEventListener('DOMContentLoaded', function(){
    const form = document.getElementById('homeInputForm');
    if(form && !form.__timerWrapped){
      form.addEventListener('submit', function(){
        const t = startBtnTimer();
        const stop = ()=>{ try{ t.stop(); }catch(e){} };
        setTimeout(stop, TIMEOUT_MS+200); // safety stop
        window.addEventListener('unhandledrejection', stop, {once:true});
      }, true);
      form.__timerWrapped = true;
    }
  });
})();

// PATCH: status bar LS/LSX padronizado
(function(){
  function formatSize(bytes){
    if(bytes<1024) return bytes+' B';
    if(bytes<1048576) return (bytes/1024).toFixed(1)+' KB';
    return (bytes/1048576).toFixed(1)+' MB';
  }
  async function getIDBUsage(){
    if(!('indexedDB' in window)) return 'IDB: não suportado';
    // tentativa de calcular uso aproximado (nem sempre disponível)
    try{
      if(navigator.storage && navigator.storage.estimate){
        const est = await navigator.storage.estimate();
        return 'IDB usado: '+formatSize(est.usage||0)+' / '+formatSize(est.quota||0);
      }
    }catch(e){}
    return 'IDB: sem dados';
  }
  function refreshStats(bar){
    try{
      const keys = Object.keys(localStorage||{});
      let bytes=0;
      for(const k of keys){
        try{ bytes += (localStorage.getItem(k)||'').length + k.length; }catch(e){}
      }
      bar.querySelector('.lsx-stats-text').textContent =
        'Chaves: '+keys.length+' · localStorage: '+formatSize(bytes);
      getIDBUsage().then(txt=>{
        bar.querySelector('.lsx-stats-idb').textContent = txt;
      });
    }catch(e){}
  }
  function attach(panelSel){
    const panel = document.querySelector(panelSel);
    if(!panel) return;
    let bar = panel.querySelector('.lsx-statusbar');
    if(!bar){
      bar = document.createElement('div');
      bar.className='lsx-statusbar';
      Object.assign(bar.style, {
        padding:'4px 6px',
        fontSize:'11px',
        background:'#111',
        color:'#0f0',
        borderBottom:'1px solid #333'
      });
      bar.innerHTML='<span class="lsx-stats-text"></span> <span class="lsx-stats-idb"></span>';
      panel.insertBefore(bar, panel.firstChild);
    }
    refreshStats(bar);
  }
  document.addEventListener('DOMContentLoaded', function(){
    attach('#lsx-panel');
    attach('#ls-panel');
    setInterval(function(){
      attach('#lsx-panel');
      attach('#ls-panel');
    }, 15000);
  });
})();

// PATCH: LS/LSX unified status (keys, size, IDB count)
(function(){
  const $=(q,r=document)=>r.querySelector(q);
  function bytesOfString(s){ try{ return (s||'').length*2; }catch(e){ return 0; } }
  function calcLocalStorageBytes(){
    let total=0; try{
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        total += bytesOfString(k) + bytesOfString(localStorage.getItem(k));
      }
    }catch(e){}
    return total;
  }
  function fmtBytes(n){
    const u=['B','KB','MB','GB']; let i=0, x=n;
    while(x>=1024 && i<u.length-1){ x/=1024; i++; }
    return (x>=10? x.toFixed(0): x.toFixed(1))+' '+u[i];
  }
  async function getIDBDatabasesCount(){
    try{
      if (indexedDB && indexedDB.databases){ const list = await indexedDB.databases(); return (list||[]).length; }
    }catch(e){}
    // fallback: registry opcional
    try{ if (Array.isArray(window.__IDB_REGISTRY)) return window.__IDB_REGISTRY.length; }catch(e){}
    return 0;
  }
  function ensureStatus(panel){
    if(!panel) return null;
    let bar = panel.querySelector('.ls-statusbar');
    if(!bar){
      bar = document.createElement('div');
      bar.className = 'ls-statusbar';
      bar.innerHTML = '<span class=\"dot\"></span><span id=\"_ls_keys\">Chaves: <b>0</b></span><span id=\"_ls_size\">Tamanho: <b>0 B</b></span><span id=\"_ls_idb\">IDB: <b>0 db</b></span>';
      panel.prepend(bar);
    }
    return bar;
  }
  async function refreshStatus(panel){
    const bar = ensureStatus(panel); if(!bar) return;
    const keys = (function(){ try{ return localStorage.length; }catch(e){ return 0; } })();
    const size = calcLocalStorageBytes();
    const idb = await getIDBDatabasesCount();
    bar.querySelector('#_ls_keys b').textContent = String(keys);
    bar.querySelector('#_ls_size b').textContent = fmtBytes(size);
    bar.querySelector('#_ls_idb b').textContent = String(idb)+' db';
  }
  async function refreshBoth(){
    await Promise.all([refreshStatus($('#lsx-panel')), refreshStatus($('#ls-panel'))]);
  }

  document.addEventListener('DOMContentLoaded', function(){
    // cria/atualiza agora
    refreshBoth();

    // atualiza quando algo muda
    window.addEventListener('storage', refreshBoth);
    // ganchos em botões conhecidos (se existirem)
    ['#lsx-refresh','#lsx-export','#lsx-import-btn','#lsx-clear-all','#lsx-clear-idb',
     '#ls-refresh','#ls-export','#ls-import-btn','#ls-clear-all','#ls-clear-idb']
      .forEach(sel=>{
        const el = $(sel); if(!el) return;
        el.addEventListener('click', function(){ setTimeout(refreshBoth, 60); }, true);
      });
  });
  // API opcional para outros módulos chamarem
  window.refreshLSStatus = refreshBoth;
})();

(function registerServiceWorker(){
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('[PWA] SW registrado:', r.scope))
      .catch(e => console.warn('[PWA] SW falhou:', e));
  });
})();

// === Canonical Keys + helpers (Brain) =====================
const K = {
  name:  'infodose:userName',
  sk:    'dual.keys.openrouter',
  model: 'dual.openrouter.model',
  train: 'dual.openrouter.training'
};
// Migra legados -> canônicos (somente se canônico estiver vazio)
(function migrateKeys(){
  const pairs = [
    ['dual.name', K.name],
    ['infodose:name', K.name],
    ['infodose:sk', K.sk],
    ['infodose:model', K.model],
  ];
  pairs.forEach(([oldKey, newKey])=>{
    try{
      const v = localStorage.getItem(oldKey);
      if (v && !localStorage.getItem(newKey)) localStorage.setItem(newKey, v);
    }catch(e){}
  });
})();

function getUserName(){ try { const a=(localStorage.getItem('infodose:userName')||'').trim(); if(a) return a; const b=(localStorage.getItem('dual.name')||'').trim(); return b; } catch(e){ return ''; } }
function getApiKey(){   return (localStorage.getItem(K.sk)   || '').trim(); }
function getModel(){
  try{
    const m = (window.LS && LS.get) ? LS.get(K.model) : localStorage.getItem(K.model);
    return (m && String(m).trim()) || 'openrouter/auto';
  }catch(e){ return 'openrouter/auto'; }
}

// Remove um app local dado sua chave 'local:ID' e re-renderize a lista
function removeLocalApp(key) {
  try {
    const id = String(key || '').replace(/^local:/, '');
    let arr = [];
    try { arr = JSON.parse(LS.raw('infodose:locals:v1') || '[]'); } catch {}
    const filtered = arr.filter(x => x && x.id !== id);
    LS.set('infodose:locals:v1', filtered);
    renderApps();
    toast('App removido', 'ok');
  } catch(e){ console.warn('Falha ao remover app local:', e); }
}
function setModel(v){
  try{
    if (window.LS && LS.set) LS.set(K.model, String(v||'openrouter/auto'));
    else localStorage.setItem(K.model, String(v||'openrouter/auto'));
  }catch(e){}
}

// Pequeno helper para fetch com timeout/abort
async function dualFetch(url, options={}, timeoutMs=20000){
  const ctl = new AbortController();
  const tId = setTimeout(()=>ctl.abort('timeout'), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctl.signal });
    return res;
  } finally {
    clearTimeout(tId);
  }
}

  // Retorna a descrição do arquétipo a partir da lista de apps embutidos (RAW.apps)
  function getArchDesc(key){
    try{
      const apps = (typeof RAW !== 'undefined' && Array.isArray(RAW.apps)) ? RAW.apps : [];
      const it = apps.find(a => (a.key || '').toLowerCase() === String(key||'').toLowerCase());
      return it && it.desc ? it.desc : '';
    }catch(e){ return ''; }
  }

(function(){
  const oldSend = window.sendAIMessage;

  async function loadDXTTrainingText(){
    try{
      const raw = localStorage.getItem(K.train);
      if(!raw) return '';
      const obj = JSON.parse(raw);
      if(!obj?.data) return '';
      const base64 = String(obj.data).split(',')[1] || '';
      if(!base64) return '';
      const bytes = atob(base64);
      return bytes.length > 64*1024 ? bytes.slice(0, 64*1024) : bytes;
    }catch{ return ''; }
  }

  function activeArchetypePair(){
    let primary = 'Dual';
    try{
      const sel = document.getElementById('arch-select');
      if(sel?.value) primary = sel.value.replace(/\.html$/i,'').toLowerCase();
    }catch{}
    // Secondary determined by custom Dual name
    let secondary = 'Dual Infodose';
    try{
      const dn = (localStorage.getItem('dual.infodoseName') || '').trim();
      if(dn) secondary = `${dn} Dual Infodose`;
    }catch{}
    const cap = s => (s||'Dual').charAt(0).toUpperCase()+s.slice(1).toLowerCase();
    return [cap(primary), cap(secondary)];
  }

  window.PowerAI = {
    async chat(userContent, sk, model, opts={}){
      const [archA, archB] = activeArchetypePair();
      const training = await loadDXTTrainingText();
      const descA = getArchDesc(archA.toLowerCase());
      const userName = getUserName();
      const sys =
`Você é o Assistente Dual Infodose — codinome "${archB}".`+
`\nArquétipo primário: ${archA}${descA ? ' – ' + descA : ''}.`+
`\nConectado simultaneamente aos arquétipos ${archA} e ${archB}.`+
 (userName ? `\nVocê conversa com ${userName}.` : '')+
`\nFale sempre em português do Brasil, direto e gentil.`+
`\nUse o contexto do app (UNO • Brain • Stack • Apps) quando útil.`
      + (training ? `\n\n# Treinamento DXT\n${training}` : '');

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
      if(!key) throw new Error("Chave OpenRouter ausente — salve em Configurações/Brain.");

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
    }
  };

  // Override legado → usa PowerAI sempre (suporta 4º arg opcional opts)
  window.sendAIMessage = async function(content, sk, model, opts={}){
    return await window.PowerAI.chat(content, sk, model, opts);
  };
})();