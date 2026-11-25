// Avisos, confirmaciones y pedidos de texto propios de TaloX, en lugar de los cuadros del navegador (alert, confirm, prompt):
// no bloquean la página, se leen bien en el móvil y respetan los colores de Xternum.
// Uso: TaloXDialogo.aviso(texto) | .confirmar(texto, {si, no}) -> Promise<boolean> | .pedirTexto(texto, {etiqueta, si}) -> Promise<string|null> (null si se cancela; texto, posiblemente vacío, si se acepta)
(function () {
  if (window.TaloXDialogo) return;
  var css = '.tdlg-fondo{position:fixed;inset:0;background:rgba(29,29,27,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:99999}' +
    '.tdlg{background:#fff;color:#1D1D1B;border-radius:12px;max-width:440px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.3);padding:22px 20px 16px;font-family:Lato,Arial,sans-serif;max-height:90vh;overflow:auto}' +
    '.tdlg p{margin:0 0 14px;font-size:15px;line-height:1.5;white-space:pre-line}' +
    '.tdlg label{display:block;font-size:12px;font-weight:700;color:#5b5b57;margin-bottom:4px}' +
    '.tdlg textarea{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:8px 10px;border:1px solid #cfd5cc;border-radius:8px;min-height:80px;margin-bottom:14px}' +
    '.tdlg .tdlg-acc{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}' +
    '.tdlg button{font:inherit;font-weight:700;font-size:14px;padding:11px 18px;border-radius:8px;cursor:pointer;min-height:44px}' +
    '.tdlg .tdlg-si{background:#00873C;color:#fff;border:0}.tdlg .tdlg-no{background:#fff;color:#1D1D1B;border:1.5px solid #cfd5cc}' +
    '.tdlg button:focus-visible,.tdlg textarea:focus-visible{outline:2px solid #1D9A8F;outline-offset:2px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function abrir(texto, o) {
    return new Promise(function (resolve) {
      var previo = document.activeElement;
      var f = document.createElement('div'); f.className = 'tdlg-fondo';
      var h = '<div class="tdlg" role="dialog" aria-modal="true" aria-label="' + esc(o.titulo || 'Aviso de TaloX') + '"><p>' + esc(texto) + '</p>';
      if (o.campo) h += '<label for="tdlg-txt">' + esc(o.etiqueta || '') + '</label><textarea id="tdlg-txt"></textarea>';
      h += '<div class="tdlg-acc">' + (o.no === false ? '' : '<button type="button" class="tdlg-no">' + esc(o.no || 'Cancelar') + '</button>') + '<button type="button" class="tdlg-si">' + esc(o.si || 'Aceptar') + '</button></div></div>';
      f.innerHTML = h; document.body.appendChild(f);
      var campo = f.querySelector('textarea'), si = f.querySelector('.tdlg-si'), no = f.querySelector('.tdlg-no');
      function cerrar(v) { document.removeEventListener('keydown', tecla, true); f.remove(); try { if (previo && previo.focus) previo.focus(); } catch (e) {} resolve(v); }
      function aceptar() { cerrar(o.campo ? campo.value.trim() : true); }
      function cancelar() { cerrar(o.campo ? null : false); }
      function tecla(ev) {
        if (ev.key === 'Escape') { ev.stopPropagation(); (o.no === false ? aceptar : cancelar)(); }
        else if (ev.key === 'Tab') { var els = [campo, no, si].filter(Boolean); var i = els.indexOf(document.activeElement); ev.preventDefault(); els[(i + (ev.shiftKey ? els.length - 1 : 1)) % els.length].focus(); }
      }
      document.addEventListener('keydown', tecla, true);
      si.addEventListener('click', aceptar); if (no) no.addEventListener('click', cancelar);
      (campo || si).focus();
    });
  }

  window.TaloXDialogo = {
    aviso: function (texto, o) { return abrir(texto, Object.assign({ no: false }, o || {})).then(function () { return undefined; }); },
    confirmar: function (texto, o) { return abrir(texto, Object.assign({ si: 'Continuar' }, o || {})); },
    pedirTexto: function (texto, o) { return abrir(texto, Object.assign({ campo: true, si: 'Enviar' }, o || {})); }
  };
})();
