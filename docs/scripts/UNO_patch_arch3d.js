
/*!
 * UNO_patch_arch3d.js — Archetypes standardizer + Platonic Solids overlay
 * Plug‑and‑play for HUB UNO — PROD (safe)
 * Requires: Three.js r155+ (CDN auto-injected if missing)
 *
 * What it does:
 * 1) Rebuilds #arch-select with 12 canonical archetypes (using aliases if files differ).
 * 2) Draws a WebGL overlay (mesh + wireframe) on top of the archetype iframe,
 *    picking a Platonic solid + color by active archetype.
 * 3) Updates automatically when you click ‹ › or change the selector.
 *
 * Drop this file right before </body> in your HTML:
 *   <script src="UNO_patch_arch3d.js"></script>
 */
(function(){
  const CANON = [
    'atlas','nova','vitalis','pulse','artemis','serena','kaos','genus','lumine','rhea','solus','aion'
  ];
  // Aliases: if canonical file doesn't exist, try these (first win)
  const ALIAS = {
    lumine: ['luxara'],
    serena: ['elysha'],
    aion:   ['kaion'],
    artemis:['horus'],
    // leave others empty – they try themselves first
  };
  // Map archetype → solid + color
  const SOLID = {
    atlas:   { kind:'cube',   color:'#409eff' },
    nova:    { kind:'icosa',  color:'#ff52b1' },
    vitalis: { kind:'tetra',  color:'#34d399' },
    pulse:   { kind:'octa',   color:'#f472b6' },
    artemis: { kind:'dodeca', color:'#22d3ee' },
    serena:  { kind:'octa',   color:'#a78bfa' },
    kaos:    { kind:'tetra',  color:'#ff4d6d' },
    genus:   { kind:'dodeca', color:'#57cf70' },
    lumine:  { kind:'icosa',  color:'#ffd54f' },
    rhea:    { kind:'octa',   color:'#00d1b2' },
    solus:   { kind:'dodeca', color:'#b691ff' },
    aion:    { kind:'icosa',  color:'#ff9f43' },
    default: { kind:'cube',   color:'#ffffff' }
  };

  // 0) Ensure Three.js available
  function ensureThree(onReady){
    if (window.THREE && THREE.Scene) return onReady();
    const s = document.createElement('script');
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/three.min.js";
    s.onload = onReady;
    document.head.appendChild(s);
  }

  // 1) Select + iframe references
  const select = document.getElementById('arch-select');
  const frame  = document.getElementById('arch-frame');
  const fade   = document.getElementById('arch-fadeCover');
  if (!select || !frame) return console.warn('[UNO_patch_arch3d] missing #arch-select or #arch-frame');

  // 2) Try to detect which files actually exist by probing fetch (HEAD/GET).
  //    If the server blocks HEAD, we ignore errors and keep candidates.
  async function exists(path){
    try {
      const res = await fetch(path, { method: 'HEAD', cache: 'no-store' });
      return res.ok;
    } catch (e) {
      // Some static hosts deny HEAD; try GET tiny range (many also deny).
      try {
        const r2 = await fetch(path, { method: 'GET', headers:{ 'Range':'bytes=0-16' }, cache:'no-store' });
        return r2.ok;
      } catch { return false; }
    }
  }

  async function resolveFile(base){ // 'atlas' -> 'atlas.html' or alias
    const tries = [base].concat(ALIAS[base]||[]);
    for (const key of tries){
      const file = `./archetypes/${key}.html`;
      if (await exists(file)) return { key, file };
    }
    // fallback: still return canonical path; iframe may 404 but user sees which is missing
    return { key: base, file: `./archetypes/${base}.html` };
  }

  // 3) Build select with resolution
  let resolved = []; // [{key, file}]
  async function rebuildSelect(){
    select.innerHTML = '';
    const arr = [];
    for (const k of CANON){
      arr.push(await resolveFile(k));
    }
    resolved = arr;
    arr.forEach((it, idx)=>{
      const opt = document.createElement('option');
      opt.value = it.file;
      opt.textContent = it.key + '.html';
      opt.dataset.key = it.key;
      select.appendChild(opt);
    });
    // If current iframe already has a src similar to an entry, match it; else pick the first
    let i = 0;
    const cur = (frame.getAttribute('src')||'').toLowerCase();
    if (cur){
      const j = arr.findIndex(x => cur.includes('/'+x.key+'.html'));
      if (j>=0) i = j;
    }
    setByIndex(i, /*noFade=*/true);
  }

  function currentKey(){
    const opt = select.options[select.selectedIndex];
    return (opt && (opt.dataset.key||'').toLowerCase()) || '';
  }

  function setByIndex(i, noFade){
    if (!resolved.length) return;
    const n = (i % resolved.length + resolved.length) % resolved.length;
    select.selectedIndex = n;
    const it = resolved[n];
    if (!noFade && fade) fade.classList.add('show');
    frame.src = it.file;
    // update 3D overlay
    updateSolid(it.key);
    // speak name (if host app exposed function)
    try {
      if (typeof window.speakArchetype === 'function') window.speakArchetype(it.key);
    } catch {}
    // remove fade soon
    if (!noFade && fade) setTimeout(()=>fade.classList.remove('show'), 200);
    // let the host know (home status etc.)
    try { if (typeof window.updateHomeStatus === 'function') window.updateHomeStatus(); } catch {}
  }

  // 4) Hook prev/next + change
  const btnPrev = document.getElementById('arch-prev');
  const btnNext = document.getElementById('arch-next');
  if (btnPrev) btnPrev.addEventListener('click', ()=> setByIndex(select.selectedIndex - 1));
  if (btnNext) btnNext.addEventListener('click', ()=> setByIndex(select.selectedIndex + 1));
  select.addEventListener('change', ()=> setByIndex(select.selectedIndex));

  // 5) Three overlay on top of the circle
  let renderer, scene, camera, mesh, wire, raf;
  const circle = document.querySelector('.arch-circle');
  if (!circle) return;

  // Create/attach canvas layer
  const layer = document.createElement('div');
  layer.id = 'arch3d-layer';
  Object.assign(layer.style, {
    position:'absolute', inset:'0', zIndex: 65, pointerEvents:'none'
  });
  circle.appendChild(layer);

  function makeGeometry(kind){
    const THREE_ = window.THREE;
    switch((kind||'').toLowerCase()){
      case 'tetra':  return new THREE_.TetrahedronGeometry(0.9, 0);
      case 'octa':   return new THREE_.OctahedronGeometry(0.9, 0);
      case 'dodeca': return new THREE_.DodecahedronGeometry(0.9, 0);
      case 'icosa':  return new THREE_.IcosahedronGeometry(0.9, 0);
      case 'cube':
      default:       return new THREE_.BoxGeometry(1.2,1.2,1.2);
    }
  }
  function resize(){
    if (!renderer || !camera) return;
    const w = circle.clientWidth, h = circle.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
  }

  function init3D(){
    const THREE_ = window.THREE;
    renderer = new THREE_.WebGLRenderer({ alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    scene = new THREE_.Scene();
    camera = new THREE_.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 3.2);
    const ambient = new THREE_.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const key = new THREE_.DirectionalLight(0xffffff, 0.8);
    key.position.set(2,2,3);
    scene.add(key);
    layer.appendChild(renderer.domElement);
    resize(); window.addEventListener('resize', resize);
  }
  function setSolid(kind, color){
    const THREE_ = window.THREE;
    if (mesh){ scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mesh=null; }
    if (wire){ scene.remove(wire); wire.geometry.dispose(); wire.material.dispose(); wire=null; }
    const geo = makeGeometry(kind);
    const mat = new THREE_.MeshStandardMaterial({
      color: color || '#ffffff',
      metalness: 0.25, roughness: 0.35,
      transparent:true, opacity:0.92
    });
    mesh = new THREE_.Mesh(geo, mat);
    const wmat = new THREE_.LineBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.28 });
    wire = new THREE_.LineSegments(new THREE_.EdgesGeometry(geo), wmat);
    scene.add(mesh); scene.add(wire);
  }
  function animate(){
    const t = performance.now() * 0.001;
    if (mesh){ mesh.rotation.x = t * 0.3; mesh.rotation.y = t * 0.45; mesh.scale.setScalar(1 + Math.sin(t*2)*0.02); }
    if (wire){ wire.rotation.x = t * 0.3; wire.rotation.y = t * 0.45; }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }

  function updateSolid(key){
    const meta = SOLID[key] || SOLID.default;
    setSolid(meta.kind, meta.color);
  }

  ensureThree(async () => {
    init3D();
    await rebuildSelect();
    cancelAnimationFrame(raf); animate();
  });

  // Optional: expose a flag to disable any background color tint from the host
  window.UNO_ARCH3D = { disableTint: true };
})();
