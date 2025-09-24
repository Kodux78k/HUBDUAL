<!-- HOTFIX: #btnLS abre LSX e não navega pro Brain -->
<script>
(function(){
  function ensureLSXPanel(){
    if (window.DualLS && typeof window.DualLS.open === 'function') return true;
    var p = document.getElementById('lsx-panel');
    if (p) return true;
    var tpl = document.getElementById('tpl-lsx-panel');
    if (!tpl) return false;
    var host = document.getElementById('lsx-mount') || document.body;
    try {
      var node = tpl.content.firstElementChild.cloneNode(true);
      host.appendChild(node);
      var closeBtn = node.querySelector('#lsx-hide');
      if (closeBtn) closeBtn.addEventListener('click', () => node.style.display='none', {passive:true});
      return true;
    } catch(e){ return false; }
  }
  function openLS(ev){
    try{ ev && ev.preventDefault(); ev && ev.stopPropagation(); }catch(e){}
    if (!ensureLSXPanel()) return false;
    if (window.DualLS){
      (window.DualLS.open ?? window.DualLS.toggle)?.call(window.DualLS);
    } else {
      var p = document.getElementById('lsx-panel'); if (p) p.style.display='block';
    }
    return false;
  }
  function bind(){
    var btn = document.getElementById('btnLS');
    if(!btn) return;
    try{ btn.onclick = null; }catch(e){}
    btn.addEventListener('click', openLS, true);   // captura
    btn.addEventListener('click', openLS, false);  // borbulha
    btn.addEventListener('keydown', e=>{
      if(e.key==='Enter' || e.key===' ') openLS(e);
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
</script>