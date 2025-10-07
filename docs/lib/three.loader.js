
// three.loader.js — prefer local modules, fallback to CDN if not present.
export async function loadThreeModules() {
  const TRY = async (path) => { try { return await import(path); } catch (e) { return null; } };
  // Prefer local
  let THREE = await TRY('/lib/three.module.js') || await TRY('./lib/three.module.js');
  if (!THREE) THREE = await TRY('https://unpkg.com/three@0.155.0/build/three.module.js');
  let EffectComposer = await TRY('/lib/EffectComposer.js') || await TRY('./lib/EffectComposer.js') ||
                       await TRY('https://unpkg.com/three@0.155.0/examples/jsm/postprocessing/EffectComposer.js');
  let RenderPass = await TRY('/lib/RenderPass.js') || await TRY('./lib/RenderPass.js') ||
                   await TRY('https://unpkg.com/three@0.155.0/examples/jsm/postprocessing/RenderPass.js');
  let UnrealBloomPass = await TRY('/lib/UnrealBloomPass.js') || await TRY('./lib/UnrealBloomPass.js') ||
                        await TRY('https://unpkg.com/three@0.155.0/examples/jsm/postprocessing/UnrealBloomPass.js');

  return { THREE, EffectComposer, RenderPass, UnrealBloomPass };
}
