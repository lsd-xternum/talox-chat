/* HITL 1: ordena la sección de insumos. Sugeridos por TaloX arriba; el resto plegado, con buscador y agrupado por carpeta.
   Todos los archivos siguen disponibles; los selectores .selector-rol-archivo no se tocan, así que el envío no cambia. */
(function () {
  function iniciar() {
    var grid = document.querySelector('.grid-archivos');
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.card-archivo'));
    if (!cards.length) return;

    var css = document.createElement('style');
    css.textContent =
      '.otros{margin-top:18px;border:1px solid var(--borde);border-radius:10px;background:#fff}' +
      '.otros>summary{cursor:pointer;padding:12px 16px;font-weight:700;font-family:Montserrat,Arial,sans-serif;font-size:14px;color:var(--negro)}' +
      '.otros-cuerpo{padding:4px 16px 16px}' +
      '.otros-cuerpo input[type=text]{margin:8px 0 6px}' +
      '.grupo-carpeta{margin-top:14px}' +
      '.grupo-carpeta>h4{margin:0 0 8px;font-size:12.5px;color:var(--suave);text-transform:uppercase;letter-spacing:.04em;font-family:Montserrat,Arial,sans-serif}' +
      '.sin-sugeridos{background:var(--aviso-fondo);border:1px solid var(--aviso-borde);border-radius:8px;padding:12px 16px;font-size:13.5px}';
    document.head.appendChild(css);

    var esMedia = function (c) {
      var n = ((c.querySelector('.tit span') || {}).textContent || '').toLowerCase();
      return /\.(png|jpe?g|gif|webp|heic|mp4|mov)$/.test(n);
    };
    var carpetaDe = function (c) { return ((c.querySelector('.meta .insignia') || {}).textContent || 'Sin carpeta').trim(); };

    var sugeridas = cards.filter(function (c) { return c.classList.contains('sugerido'); });
    var otras = cards.filter(function (c) { return !c.classList.contains('sugerido'); });

    // En las no sugeridas el "criterio" no aporta: se oculta
    otras.forEach(function (c) { var k = c.querySelector('.criterio'); if (k) k.style.display = 'none'; });

    grid.innerHTML = '';
    if (sugeridas.length) {
      sugeridas.forEach(function (c) { grid.appendChild(c); });
    } else {
      var aviso = document.createElement('div');
      aviso.className = 'sin-sugeridos';
      aviso.textContent = 'TaloX no sugirió ningún archivo como insumo. Puedes buscar y marcar manualmente en "Otros archivos del cliente".';
      grid.parentNode.insertBefore(aviso, grid);
    }

    if (!otras.length) return;
    var det = document.createElement('details');
    det.className = 'otros';
    var sum = document.createElement('summary');
    det.appendChild(sum);
    var cuerpo = document.createElement('div');
    cuerpo.className = 'otros-cuerpo';
    var buscar = document.createElement('input');
    buscar.type = 'text';
    buscar.placeholder = 'Buscar por nombre o carpeta…';
    cuerpo.appendChild(buscar);
    var grupos = {};
    var orden = [];
    otras.forEach(function (c) {
      var g = esMedia(c) ? 'Imágenes y videos' : carpetaDe(c);
      if (!grupos[g]) { grupos[g] = []; orden.push(g); }
      grupos[g].push(c);
    });
    // Las imágenes al final
    orden.sort(function (a, b) { return (a === 'Imágenes y videos') - (b === 'Imágenes y videos'); });
    var secciones = orden.map(function (g) {
      var s = document.createElement('div');
      s.className = 'grupo-carpeta';
      var h = document.createElement('h4'); h.textContent = g + ' (' + grupos[g].length + ')';
      var gr = document.createElement('div'); gr.className = 'grid-archivos';
      grupos[g].forEach(function (c) { gr.appendChild(c); });
      s.appendChild(h); s.appendChild(gr); cuerpo.appendChild(s);
      return { s: s, cards: grupos[g] };
    });
    det.appendChild(cuerpo);
    grid.parentNode.insertBefore(det, grid.nextSibling);

    function resumen() {
      var marcados = otras.filter(function (c) { var s = c.querySelector('.selector-rol-archivo'); return s && s.value !== 'omitir'; }).length;
      sum.textContent = 'Otros archivos del cliente (' + otras.length + ')' + (marcados ? ' · ' + marcados + ' incluido' + (marcados > 1 ? 's' : '') : '');
    }
    resumen();
    otras.forEach(function (c) { var s = c.querySelector('.selector-rol-archivo'); if (s) s.addEventListener('change', resumen); });
    buscar.addEventListener('input', function () {
      var q = buscar.value.trim().toLowerCase();
      secciones.forEach(function (sec) {
        var visibles = 0;
        sec.cards.forEach(function (c) {
          var ok = !q || c.textContent.toLowerCase().indexOf(q) >= 0;
          c.style.display = ok ? '' : 'none';
          if (ok) visibles++;
        });
        sec.s.style.display = visibles ? '' : 'none';
      });
      if (q) det.open = true;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
