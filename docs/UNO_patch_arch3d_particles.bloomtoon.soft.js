
/*!
 * UNO_patch_arch3d_particles.js — Archetypes + Platonic Solids + Particles
 * - Builds canonical 12 archetypes list with aliases
 * - Renders Platonic solid overlay (mesh + wireframe) inside .arch-circle
 * - Adds ambient PARTICLES (Points) that orbit slowly
 * - Syncs the "voice" button icon to the active solid (inline SVG)
 *
 * DOM assumptions (fallback-friendly):
 *  - #arch-select  : <select> of archetypes
 *  - #arch-frame   : <iframe> that loads ./archetypes/<name>.html
 *  - .arch-circle  : container of the round area (overlay is appended here)
 *  - Voice button candidates: #btnVoice, #archAudioBtn, #homeVoiceBtn (first found wins)
 *
 * Drop-in: place right before </body>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/three.min.js"></script>
 *   <script src="UNO_patch_arch3d_particles.js"></script>
 */
(function(){
  const CANON = ['atlas','nova','vitalis','pulse','artemis','serena','kaos','genus','lumine','rhea','solus','aion'];
  const ALIAS = { lumine:['luxara'], serena:['elysha'], aion:['kaion'], artemis:['horus'] };
  const SOLID = {
    atlas:{kind:'cube',   color:'#409eff'},
    nova:{kind:'icosa',   color:'#ff52b1'},
    vitalis:{kind:'tetra',color:'#34d399'},
    pulse:{kind:'octa',   color:'#f472b6'},
    artemis:{kind:'dodeca',color:'#22d3ee'},
    serena:{kind:'dodeca',  color:'#a78bfa'},
    kaos:{kind:'tetra',   color:'#ff4d6d'},
    genus:{kind:'dodeca', color:'#57cf70'},
    lumine:{kind:'icosa', color:'#ffd54f'},
    rhea:{kind:'octa',    color:'#00d1b2'},
    solus:{kind:'dodeca', color:'#b691ff'},
    aion:{kind:'icosa',   color:'#ff9f43'},
    default:{kind:'cube', color:'#ffffff'}
  };

  const $ = (q,r=document)=>r.querySelector(q);

  function ensureThree(onReady){
    if (window.THREE && THREE.Scene) return onReady();
    const s = document.createElement('script');
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/three.min.js";
    s.onload = onReady;
    document.head.appendChild(s);
  }

  const select = $('#arch-select');
  const frame  = $('#arch-frame');
  const circle = $('.arch-circle');
  const fade   = $('#arch-fadeCover');
  if (!select || !frame || !circle) return;

  async function exists(path){
    try { const res = await fetch(path,{method:'HEAD',cache:'no-store'}); return res.ok; }
    catch(e){ try{ const r2 = await fetch(path,{method:'GET',headers:{'Range':'bytes=0-16'},cache:'no-store'}); return r2.ok; } catch { return false; } }
  }
  async function resolveFile(base){
    const tries = [base].concat(ALIAS[base]||[]);
    for (const key of tries){
      const file = `./archetypes/${key}.html`;
      if (await exists(file)) return { key, file };
    }
    return { key: base, file: `./archetypes/${base}.html` };
  }

  let resolved = [];
  async function rebuildSelect(){
    select.innerHTML='';
    for (const k of CANON){
      const it = await resolveFile(k);
      resolved.push(it);
      const opt = document.createElement('option');
      opt.value = it.file; opt.textContent = it.key + '.html'; opt.dataset.key = it.key;
      select.appendChild(opt);
    }
    // pick current by iframe src if matches; else first
    let idx = 0;
    const cur = (frame.getAttribute('src')||'').toLowerCase();
    if (cur){
      const j = resolved.findIndex(x => cur.includes('/'+x.key+'.html'));
      if (j>=0) idx = j;
    }
    setByIndex(idx, true);
  }

  function currentKey(){
    const opt = select.options[select.selectedIndex];
    return (opt && (opt.dataset.key||'').toLowerCase()) || 'atlas';
  }

  function setByIndex(i, noFade){
    const n = (i % resolved.length + resolved.length) % resolved.length;
    select.selectedIndex = n;
    const it = resolved[n];
    if (!noFade && fade) fade.classList.add('show');
    frame.src = it.file;
    updateSolid(it.key);
    if (!noFade && fade) setTimeout(()=>fade.classList.remove('show'), 200);
    try { if (typeof window.updateHomeStatus==='function') window.updateHomeStatus(); } catch {}
  }

  const btnPrev = $('#arch-prev'), btnNext = $('#arch-next');
  if (btnPrev) btnPrev.addEventListener('click', ()=> setByIndex(select.selectedIndex - 1));
  if (btnNext) btnNext.addEventListener('click', ()=> setByIndex(select.selectedIndex + 1));
  select.addEventListener('change', ()=> setByIndex(select.selectedIndex));

  // 3D setup
  let renderer, scene, camera, mesh, wire, particles, raf;
  const layer = document.createElement('div');
  layer.id = 'arch3d-layer';
  Object.assign(layer.style, { position:'absolute', inset:'0', zIndex:65, pointerEvents:'none' });
  circle.appendChild(layer);

  function geoByKind(kind){
    const T = window.THREE;
    switch((kind||'').toLowerCase()){
      case 'tetra':  return new T.TetrahedronGeometry(0.9, 0);
      case 'octa':   return new T.OctahedronGeometry(0.9, 0);
      case 'dodeca': return new T.DodecahedronGeometry(0.9, 0);
      case 'icosa':  return new T.IcosahedronGeometry(0.9, 0);
      case 'cube':
      default:       return new T.BoxGeometry(1.2,1.2,1.2);
    }
  }

  function init3D(){
    const T = window.THREE;
    renderer = new T.WebGLRenderer({ alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 3.2);
    scene.add(new T.AmbientLight(0xffffff, 0.6));
    const key = new T.DirectionalLight(0xffffff, 0.8); key.position.set(2,2,3); scene.add(key);
    layer.appendChild(renderer.domElement);
    // Build composer.
    ensurePostFX(()=>{
      try{
        renderPass = new THREE_.RenderPass(scene, camera);
        const rtW = circle.clientWidth||512, rtH = circle.clientHeight||512;
        bloomPass  = new THREE_.UnrealBloomPass(new THREE_.Vector2(rtW, rtH), 0.45, 0.38, 0.82);
        composer   = new THREE_.EffectComposer(renderer);
        composer.addPass(renderPass);
        composer.addPass(bloomPass);
      }catch(e){}
    });
    resize(); window.addEventListener('resize', resize);
  }

  function makeParticles(colorHex){
    const T = window.THREE;
    const COUNT = 600;
    const g = new T.BufferGeometry();
    const pos = new Float32Array(COUNT*3);
    for (let i=0;i<COUNT;i++){
      // radial shell around the solid
      const r = 1.5 + Math.random()*0.8; // radius 1.5–2.3
      const th = Math.random()*Math.PI*2;
      const ph = Math.acos(2*Math.random()-1);
      const x = r*Math.sin(ph)*Math.cos(th);
      const y = r*Math.sin(ph)*Math.sin(th);
      const z = r*Math.cos(ph);
      pos[i*3+0]=x; pos[i*3+1]=y; pos[i*3+2]=z;
    }
    g.setAttribute('position', new T.BufferAttribute(pos,3));
    const m = new T.PointsMaterial({ size: 0.02, color: colorHex || 0xffffff, transparent:true, opacity:0.6 });
    return new T.Points(g,m);
  }

  function setSolid(kind, color){
    const T = window.THREE;
    if (mesh){ scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh=null; }
    if (wire){ scene.remove(wire); wire.geometry.dispose(); wire.material.dispose(); wire=null; }
    if (particles){ scene.remove(particles); particles.geometry.dispose(); particles.material.dispose(); particles=null; }

    const geo = geoByKind(kind);
    const mat = new T.MeshStandardMaterial({ color: color||'#fff', metalness:0.25, roughness:0.35, transparent:true, opacity:0.92 });
    mesh = new T.Mesh(geo, mat);

    const wmat = new T.LineBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.28 });
    wire = new T.LineSegments(new T.EdgesGeometry(geo), wmat);

    particles = makeParticles(color);

    scene.add(mesh); scene.add(wire); scene.add(particles);
  }

  function resize(){
    if (!renderer || !camera) return;
    const w = circle.clientWidth, h = circle.clientHeight;
    renderer.setSize(w, h, false);
    try{ if (composer) composer.setSize(w, h); }catch{}
    camera.aspect = Math.max(w/h, 0.0001);
    camera.updateProjectionMatrix();
  }

  
  // External breath (audio‑reactive) support
  let __breath = 0, __breathTarget = 0;
function animate(){
    const t = performance.now()*0.001;
    if (mesh){ mesh.rotation.x = t*0.3; mesh.rotation.y = t*0.45; mesh.scale.setScalar(1 + Math.sin(t*2)*0.02); }
    if (wire){ wire.rotation.x = t*0.3; wire.rotation.y = t*0.45; }
    if (particles){ particles.rotation.y = t*0.12; particles.rotation.x = Math.sin(t*0.25)*0.04; }
    if (composer) if (mesh) { const s = 1 + __breath * 0.12; mesh.scale.setScalar(s); if (wire) wire.scale.setScalar(s); }
      composer.render(); else renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }

  // Voice button icon sync (inline SVG per solid)
  const voiceBtn = $('#btnVoice') || $('#archAudioBtn') || $('#homeVoiceBtn');
  const SVGs = {
    cube:    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 7l9-5 9 5v10l-9 5-9-5V7z"/><path fill="#fff" opacity=".2" d="M12 2v20"/></svg>',
    tetra:   '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3l9 18H3L12 3z"/></svg>',
    octa:    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2l8 10-8 10L4 12 12 2z"/></svg>',
    dodeca:  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 3h10l5 7-5 7H7L2 10 7 3z"/></svg>',
    icosa:   '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor"/><path d="M12 2l6 10-6 10L6 12 12 2z"/></svg>'
  };
  function setVoiceIcon(kind, color){
    if (!voiceBtn) return;
    const svg = SVGs[kind] || SVGs.cube;
    voiceBtn.innerHTML = svg;
    voiceBtn.style.setProperty('--voice-accent', color||'#fff');
    voiceBtn.style.color = color||'#fff';
    voiceBtn.title = `Sólido: ${kind}`;
  }

  function updateSolid(key){
    const meta = SOLID[key] || SOLID.default;
    setSolid(meta.kind, meta.color);
    setVoiceIcon(meta.kind, meta.color);
  }

  
  // === Post FX (EffectComposer + UnrealBloom) loader ===
  function ensurePostFX(onReady){
    if (window.THREE && THREE.EffectComposer && THREE.UnrealBloomPass) return onReady();
    let q = 0;
    function add(src){
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = ()=>{ q--; if (!q) onReady(); };
      s.onerror = ()=>{ q--; if (!q) onReady(); };
      document.head.appendChild(s); q++;
    }
    const cdn = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/examples/js/postprocessing";
    add(cdn + "/EffectComposer.js");
    add(cdn + "/RenderPass.js");
    add(cdn + "/UnrealBloomPass.js");
  }

  ensureThree(async ()=>{
    init3D();
    await rebuildSelect();
    cancelAnimationFrame(raf); animate();
  });

  // Public flag
  window.UNO_ARCH3D = { disableTint:true , setBreath: v => { __breathTarget = +v || 0 } };
})();
