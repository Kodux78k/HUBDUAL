/* UNO Patch — 12 Archetypes standardization + Platonic Solids overlay (2025-09-30)
 * Drop-in script: include right before </body> in your HUB UNO HTML.
 * Requires: none (loads THREE from CDN).
 * Effect:
 *  - Rebuilds the archetype selector to the canonical 12 (with alias fallback).
 *  - Adds a WebGL overlay in the central circle that renders a Platonic solid per archetype.
 *  - Hooks prev/next and select change. Does not modify your iframe contents.
 */
(function(){
  // Load THREE if missing
  function loadThree(){
    return new Promise((resolve) => {
      if (window.THREE) return resolve();
      const s = document.createElement('script');
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/three.min.js";
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }

  // Canonical 12 archetypes
  const CANON = ['atlas','nova','vitalis','pulse','artemis','serena','kaos','genus','lumine','rhea','solus','aion'];
  // Aliases (fallback to these if your zip uses different names)
  const ALIAS = { luxara: 'lumine', kaion: 'aion', horus: 'artemis', elysha: 'serena' };

  async function fileExists(name){
    try {
      const res = await fetch('./archetypes/'+name+'.html', { method: 'GET', cache: 'no-cache' });
      return res.ok;
    } catch { return false; }
  }

  async function buildArchetypeList(){
    const list = [];
    for (const key of CANON) {
      if (await fileExists(key)) list.push(key);
      else {
        const aliasKey = Object.keys(ALIAS).find(a => ALIAS[a] === key);
        if (aliasKey && await fileExists(aliasKey)) list.push(aliasKey);
      }
    }
    // Append stray known names if present
    for (const stray of ['luxara','kaion','horus','elysha']) {
      if (!list.includes(stray) && await fileExists(stray)) list.push(stray);
    }
    return list.length ? list : CANON;
  }

  function setSelectOptions(list){
    const select = document.getElementById('arch-select');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '';
    list.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name + '.html';
      opt.textContent = name + '.html';
      select.appendChild(opt);
    });
    // Preserve previous selection when possible
    if (current && Array.from(select.options).some(o => o.value === current)) {
      select.value = current;
    }
    // Trigger change for first render
    select.dispatchEvent(new Event('change'));
  }

  // 3D engine
  let scene, camera, renderer, meshGroup, rafId;
  function ensureRenderer(){
    const archCircle = document.querySelector('.arch-circle');
    if (!archCircle) return null;
    if (renderer) return renderer;
    const canvas = document.createElement('canvas');
    canvas.id = 'arch3d';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.zIndex = '65'; // below audio ripple (70) but above iframe
    canvas.style.pointerEvents = 'none';
    archCircle.insertBefore(canvas, archCircle.firstChild);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, archCircle.clientWidth/archCircle.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 5.2);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(archCircle.clientWidth, archCircle.clientHeight);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.PointLight(0xffffff, 0.9); key.position.set(6,6,6); scene.add(key);
    const rim = new THREE.PointLight(0x00ffff, 0.6); rim.position.set(-6,-4,-4); scene.add(rim);

    window.addEventListener('resize', () => {
      if (!archCircle) return;
      camera.aspect = archCircle.clientWidth/archCircle.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(archCircle.clientWidth, archCircle.clientHeight);
    });
    return renderer;
  }

  const SOLID_FOR = {
    atlas: 'cube',
    nova: 'icosa',
    vitalis: 'tetra',
    pulse: 'octa',
    artemis: 'dodeca',
    serena: 'octa',
    kaos: 'tetra',
    genus: 'dodeca',
    lumine: 'icosa',
    rhea: 'octa',
    solus: 'dodeca',
    aion: 'icosa',
    // aliases keep a sensible pick
    luxara: 'icosa',
    kaion: 'icosa',
    horus: 'dodeca',
    elysha: 'octa'
  };
  const COLOR_FOR = {
    atlas:'#409eff', nova:'#ff52b1', vitalis:'#34d399', pulse:'#f472b6',
    artemis:'#22d3ee', serena:'#a78bfa', kaos:'#ff4d6d', genus:'#57cf70',
    lumine:'#ffd54f', rhea:'#00d1b2', solus:'#b691ff', aion:'#ff9f43',
    luxara:'#b560ff', kaion:'#00bfff', horus:'#ffc300', elysha:'#ba82db'
  };

  function geometryByKey(key){
    const kind = SOLID_FOR[key] || 'icosa';
    switch(kind){
      case 'tetra': return new THREE.TetrahedronGeometry(1.35, 0);
      case 'cube': return new THREE.BoxGeometry(1.8, 1.8, 1.8);
      case 'octa': return new THREE.OctahedronGeometry(1.5, 0);
      case 'dodeca': return new THREE.DodecahedronGeometry(1.45, 0);
      case 'icosa':
      default: return new THREE.IcosahedronGeometry(1.5, 0);
    }
  }

  function set3DFor(name){
    if (!renderer || !scene) return;
    const key = String(name||'').replace(/\.html$/,'').toLowerCase();
    if (meshGroup) {
      scene.remove(meshGroup);
      meshGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      meshGroup = null;
    }
    const geom = geometryByKey(key);
    const baseColor = new THREE.Color(COLOR_FOR[key] || '#9b59b6');
    const mat = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.55, roughness: 0.25, transparent: true, opacity: 0.92 });
    const mesh = new THREE.Mesh(geom, mat);
    const edges = new THREE.EdgesGeometry(geom);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent:true, opacity: 0.35 });
    const wire = new THREE.LineSegments(edges, wireMat);
    meshGroup = new THREE.Group();
    meshGroup.add(mesh);
    meshGroup.add(wire);
    scene.add(meshGroup);
  }

  let t0 = performance.now();
  function animate(){
    rafId = requestAnimationFrame(animate);
    if (meshGroup) {
      const t = (performance.now() - t0)/1000;
      meshGroup.rotation.y = t * 0.6;
      meshGroup.rotation.x = Math.sin(t*0.7) * 0.2 + 0.2;
      const s = 1 + Math.sin(t*1.2) * 0.045; // subtle "duplo" pulse
      meshGroup.scale.set(s,s,s);
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function init3D(){
    ensureRenderer();
    if (!renderer) return;
    if (!rafId) animate();
    const sel = document.getElementById('arch-select');
    const currentName = sel && sel.value ? sel.value.replace(/\.html$/,'') : 'atlas';
    set3DFor(currentName);
  }

  async function bootstrap(){
    await loadThree();
    const list = await buildArchetypeList();
    setSelectOptions(list);
    init3D();
    // Hook UI events
    const sel = document.getElementById('arch-select');
    const prev = document.getElementById('arch-prev');
    const next = document.getElementById('arch-next');
    if (sel) sel.addEventListener('change', () => set3DFor(sel.value));
    function updateLater(){
      setTimeout(() => {
        if (sel) set3DFor(sel.value);
      }, 160);
    }
    if (prev) prev.addEventListener('click', updateLater);
    if (next) next.addEventListener('click', updateLater);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();