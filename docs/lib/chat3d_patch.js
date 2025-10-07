
/*! Chat3D background (Three.js) – partículas orbitando atrás do feed */
(function(){
  function ensureThree(onReady){
    if (window.THREE && THREE.Scene) return onReady();
    const s = document.createElement('script');
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/three.min.js";
    s.onload = onReady;
    document.head.appendChild(s);
  }
  const feed = document.getElementById('chatFeed');
  if (!feed) return;
  // Wrap
  const wrap = document.createElement('div'); wrap.className='chat3d-wrap';
  const parent = feed.parentElement; parent.insertBefore(wrap, feed); wrap.appendChild(feed);
  const bg = document.createElement('div'); bg.className='chat3d-canvas'; wrap.appendChild(bg);

  let renderer, scene, camera, particles, raf;
  function init(){
    const T = window.THREE;
    renderer = new T.WebGLRenderer({ alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0,0,6);
    bg.appendChild(renderer.domElement);

    // particles
    const COUNT = 1000;
    const g = new T.BufferGeometry();
    const pos = new Float32Array(COUNT*3);
    for (let i=0;i<COUNT;i++){
      const r = 2.5 + Math.random()*3.0;  // behind-feed sphere shell
      const th = Math.random()*Math.PI*2;
      const ph = Math.acos(2*Math.random()-1);
      pos[i*3+0] = r*Math.sin(ph)*Math.cos(th);
      pos[i*3+1] = r*Math.sin(ph)*Math.sin(th);
      pos[i*3+2] = r*Math.cos(ph);
    }
    g.setAttribute('position', new T.BufferAttribute(pos,3));
    const mat = new T.PointsMaterial({ size: 0.02, color: 0xffffff, opacity:0.35, transparent:true });
    particles = new T.Points(g, mat);
    scene.add(particles);

    resize(); window.addEventListener('resize', resize);
  }
  function resize(){
    const w = bg.clientWidth, h = bg.clientHeight;
    renderer.setSize(w,h,false);
    camera.aspect = Math.max(w/h, 0.0001);
    camera.updateProjectionMatrix();
  }
  function tick(){
    const t = performance.now()*0.001;
    if (particles){ particles.rotation.y = t*0.05; particles.rotation.x = Math.sin(t*0.2)*0.02; }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  ensureThree(()=>{ init(); cancelAnimationFrame(raf); tick(); });
})();
