
/*! uno_audio_breath.js — maps microphone RMS to UNO_ARCH3D.setBreath() */
(function(){
  async function init(){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      function tick(){
        analyser.getByteFrequencyData(buf);
        // Simple RMS/energy over mid band to avoid breath pumping on noise floor
        let sum = 0;
        for (let i=4; i<buf.length; i++) sum += buf[i]*buf[i];
        const rms = Math.sqrt(sum / (buf.length-4)) / 255;
        if (window.UNO_ARCH3D && typeof window.UNO_ARCH3D.setBreath === 'function') {
          window.UNO_ARCH3D.setBreath(Math.min(1, rms*1.8));
        }
        requestAnimationFrame(tick);
      }
      tick();
    } catch (e) {
      console.warn('[uno_audio_breath] mic denied or failed', e);
    }
  }

  // Enable on first user gesture (click/touch) to satisfy autoplay policies
  let armed = false;
  function arm(){
    if (armed) return;
    armed = true;
    init();
    window.removeEventListener('pointerdown', arm, true);
  }
  window.addEventListener('pointerdown', arm, true);

  // Also attach to voice/mic buttons if present
  ['archAudioBtn','homeVoiceBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', arm, { once:true });
  });
})();
