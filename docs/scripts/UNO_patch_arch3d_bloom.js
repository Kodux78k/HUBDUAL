
// UNO_patch_arch3d_bloom.js — Overlay 3D with photographic bloom + per‑archetype colors
// Usage (HUB UNO): <script type="module" src="UNO_patch_arch3d_bloom.js"></script>
import * as THREE from 'https://unpkg.com/three@0.155.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.155.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.155.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.155.0/examples/jsm/postprocessing/UnrealBloomPass.js';

const SOLID = {
  atlas:{kind:'cube',   color:'#409eff'},
  nova:{kind:'icosa',   color:'#ff52b1'},
  vitalis:{kind:'tetra',color:'#34d399'},
  pulse:{kind:'octa',   color:'#f472b6'},
  artemis:{kind:'dodeca',color:'#22d3ee'},
  serena:{kind:'octa',  color:'#a78bfa'},
  kaos:{kind:'tetra',   color:'#ff4d6d'},
  genus:{kind:'dodeca', color:'#57cf70'},
  lumine:{kind:'icosa', color:'#ffd54f'},
  rhea:{kind:'octa',    color:'#00d1b2'},
  solus:{kind:'dodeca', color:'#b691ff'},
  aion:{kind:'icosa',   color:'#ff9f43'}
};

const $ = (q,r=document)=>r.querySelector(q);
const select = $('#arch-select');
const circle = $('.arch-circle');
if (!select || !circle) {
  console.warn('[UNO_patch_arch3d_bloom] Missing #arch-select or .arch-circle');
}

const layer = document.createElement('div');
layer.style.position = 'absolute';
layer.style.inset = '0';
layer.style.pointerEvents = 'none';
layer.style.zIndex = '5';
circle?.appendChild(layer);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
renderer.setSize(circle?.clientWidth||320, circle?.clientHeight||320);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
layer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
camera.position.set(0,0.2,3.4);

scene.add(new THREE.AmbientLight(0xffffff, 0.22));
scene.add(new THREE.HemisphereLight(0xa0b8ff, 0x0b0f14, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.2); dir.position.set(2.5,3.5,2.0); scene.add(dir);

function geo(kind) {
  switch(kind){
    case 'cube': return new THREE.BoxGeometry(1.2,1.2,1.2,1,1,1);
    case 'tetra': return new THREE.TetrahedronGeometry(1.2,0);
    case 'octa': return new THREE.OctahedronGeometry(1.2,0);
    case 'icosa': return new THREE.IcosahedronGeometry(1.2,0);
    case 'dodeca': return new THREE.DodecahedronGeometry(1.2,0);
    default: return new THREE.IcosahedronGeometry(1.2,0);
  }
}

let mesh, wire, composer, bloomPass;
function setSolid(kind, hex){
  const color = new THREE.Color(hex);
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
  if (wire) { scene.remove(wire); wire.geometry.dispose(); }
  const g = geo(kind);
  const mat = new THREE.MeshStandardMaterial({
    color, metalness:0.68, roughness:0.22, envMapIntensity:1.2,
    emissive: color.clone().multiplyScalar(0.03), emissiveIntensity:1.0,
    clearcoat:0.3, clearcoatRoughness:0.4
  });
  mesh = new THREE.Mesh(g, mat);
  scene.add(mesh);
  const edges = new THREE.EdgesGeometry(g, 20);
  const lineMat = new THREE.LineBasicMaterial({ color: hex, transparent:true, opacity:0.85 });
  wire = new THREE.LineSegments(edges, lineMat);
  wire.scale.setScalar(1.003);
  scene.add(wire);

  // Post FX
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const strength = 0.8;
  bloomPass = new UnrealBloomPass(new THREE.Vector2(renderer.domElement.width, renderer.domElement.height), strength, 0.55, 0.18);
  composer.addPass(bloomPass);
}

function update() {
  const key = (select?.value || 'atlas').toLowerCase();
  const meta = SOLID[key] || SOLID.atlas;
  setSolid(meta.kind, meta.color);
}

let rot = 0;
function animate(){
  requestAnimationFrame(animate);
  if (mesh && wire){
    const rs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rotateSpeed')) || 0.6;
    rot += 0.012 * rs;
    mesh.rotation.set(0.24*rot, 0.7*rot, 0);
    wire.rotation.copy(mesh.rotation);
  }
  (composer ? composer : renderer).render(scene, camera);
}
animate();

// resize
const ro = new ResizeObserver(entries=>{
  for (const e of entries){
    const w = e.contentRect.width, h = e.contentRect.height;
    renderer.setSize(w,h);
    camera.aspect = w/h; camera.updateProjectionMatrix();
    composer?.setSize(w,h);
  }
});
if (circle) ro.observe(circle);

// hooks
select?.addEventListener('change', update);
document.querySelector('#arch-prev')?.addEventListener('click', ()=> setTimeout(update, 0));
document.querySelector('#arch-next')?.addEventListener('click', ()=> setTimeout(update, 0));

update();
