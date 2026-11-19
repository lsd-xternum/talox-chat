(function () {
  var D = window.__DATOS__ || {};
  var WH = D.webhook;
  var cat = D.catalogo || { productos: [], plantillas: [] };
  var P = D.pedido || {};
  var plantillas = {};
  cat.plantillas.forEach(function (p) { plantillas[p.codigo] = p; });
  var productos = {};
  cat.productos.forEach(function (p) { productos[p.codigo] = p; });
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var ESTADOS = { pendiente: ['Pendiente', 'azul'], en_curso: ['En curso', 'ambar'], aprobado: ['Aprobado', 'verde'], rechazado: ['Rechazado', 'rojo'], fallido: ['Falló', 'rojo'], salteado: ['Salteado', ''] };

  function post(ruta, cuerpo) {
    return fetch(WH + '/' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok !== false, j: j }; }); });
  }

  /* ---------- Modo gestión (pedido ya confirmado) ---------- */
  function gestion() {
    $('titulo-paso').textContent = 'Seguimiento del pedido';
    var ents = D.entregables || [];
    var html = '<p class="ayuda">Estado del pedido: <strong>' + esc(P.estado) + '</strong>. Los entregables se producen uno después del otro; cada uno aprobado alimenta al siguiente.</p><ul class="lista">';
    ents.forEach(function (e) {
      var st = ESTADOS[e.estado] || [e.estado, ''];
      var acciones = '';
      if (P.estado === 'pausado' && (e.estado === 'rechazado' || e.estado === 'fallido')) {
        acciones = '<button class="mini" data-a="rehacer" data-o="' + e.orden + '">Rehacer</button> <button class="mini" data-a="saltear" data-o="' + e.orden + '">Saltear</button>';
      }
      html += '<li class="item"><span class="orden">' + e.orden + '</span><span class="nombre">' + esc(e.plantilla_nombre || e.plantilla_codigo) +
        '<small>' + esc(e.notas || '') + (e.documento_url ? ' <a href="' + esc(e.documento_url) + '" target="_blank">Abrir documento ↗</a>' : '') + '</small></span>' +
        '<span class="etq ' + st[1] + '">' + esc(st[0]) + '</span>' + acciones + '</li>';
    });
    html += '</ul><div id="msg" class="msg"></div>';
    if (P.estado === 'pausado') html += '<div class="caja-err">El pedido está en pausa: un entregable fue rechazado o falló. Elige qué hacer con él: <strong>Rehacer</strong> lo vuelve a producir, <strong>Saltear</strong> continúa con el siguiente, o cancela el pedido.</div>';
    if (P.estado === 'en_curso' || P.estado === 'pausado') html += '<p><button class="boton-peligro" id="cancelar">Cancelar pedido</button></p>';
    $('lista-zona').innerHTML = html;
    $('zona-producto').style.display = 'none';
    $('zona-picker').style.display = 'none';
    if ($('zona-proyectos')) $('zona-proyectos').style.display = 'none';
    $('pie').style.display = 'none';
    var por = function () { return (prompt('¿Quién decide? (tu nombre)') || '').trim() || 'consultor'; };
    document.querySelectorAll('[data-a]').forEach(function (b) {
      b.onclick = function () {
        b.disabled = true;
        post('pedido-accion', { pedido_id: P.pedido_id, accion: b.dataset.a, orden: Number(b.dataset.o), por: por() }).then(function (r) {
          if (r.ok) location.reload(); else { $('msg').className = 'msg err'; $('msg').textContent = r.j.motivo || 'No se pudo aplicar la acción'; b.disabled = false; }
        });
      };
    });
    var c = $('cancelar');
    if (c) c.onclick = function () {
      if (!confirm('¿Cancelar el pedido? Los entregables pendientes no se producirán.')) return;
      post('pedido-accion', { pedido_id: P.pedido_id, accion: 'cancelar', por: por() }).then(function (r) { if (r.ok) location.reload(); else { $('msg').className = 'msg err'; $('msg').textContent = r.j.motivo || 'No se pudo cancelar'; } });
    };
    if (P.estado === 'en_curso') setTimeout(function () { location.reload(); }, 20000);
  }

  /* ---------- Modo propuesta (HITL 0) ---------- */
  var producto = null;
  var lista = [];       // códigos de plantilla en orden
  var inicial = [];     // propuesta original, para registrar cambios

  function codigosDe(x) { return (x || []).map(function (i) { return typeof i === 'string' ? i : (i && (i.codigo || i.plantilla_codigo)); }).filter(Boolean); }

  function propuesta() {
    var pp = P.propuesta_producto || {};
    producto = pp.producto_codigo || P.producto_codigo || null;
    var cods = codigosDe(pp.plantillas_propuestas || pp.plantillas);
    if (!cods.length && producto && productos[producto]) cods = productos[producto].plantillas.slice();
    lista = cods.filter(function (c) { return plantillas[c]; });
    inicial = lista.slice();
  }

  function pintarProducto() {
    var h = '<option value="">— Sin producto (a medida) —</option>';
    cat.productos.forEach(function (p) { h += '<option value="' + esc(p.codigo) + '"' + (p.codigo === producto ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; });
    $('producto').innerHTML = h;
    $('producto').onchange = function () {
      producto = this.value || null;
      if (producto && productos[producto] && confirm('¿Reemplazar la lista actual por los entregables de este producto?')) {
        lista = productos[producto].plantillas.filter(function (c) { return plantillas[c]; });
      }
      pintarLista(); pintarResultados();
    };
  }

  function etiquetaPlantilla(p) {
    var t = '';
    if (!p.ejecutable) t += '<span class="etq rojo">' + esc(p.bloqueo || 'No ejecutable') + '</span> ';
    else if (p.estado && p.estado !== 'aprobado') t += '<span class="etq ambar">' + esc(p.estado) + '</span> ';
    return t;
  }

  function pintarLista() {
    var ul = $('entregables');
    if (!lista.length) { ul.innerHTML = '<li class="msg">Todavía no hay entregables. Agrégalos con el buscador.</li>'; actualizarConfirmar(); return; }
    ul.innerHTML = lista.map(function (c, i) {
      var p = plantillas[c] || { nombre: c, ejecutable: false, bloqueo: 'No existe' };
      return '<li class="item' + (p.ejecutable ? '' : ' bloqueada') + '" draggable="true" data-i="' + i + '"><span class="asa">⋮⋮</span><span class="orden">' + (i + 1) + '</span>' +
        '<span class="nombre">' + esc(p.nombre) + '<small>' + esc(p.descripcion || '') + '</small></span>' + etiquetaPlantilla(p) +
        '<button class="mini" data-m="up" data-i="' + i + '" title="Subir">↑</button><button class="mini" data-m="down" data-i="' + i + '" title="Bajar">↓</button><button class="mini" data-m="del" data-i="' + i + '" title="Quitar">✕</button></li>';
    }).join('');
    ul.querySelectorAll('button[data-m]').forEach(function (b) {
      b.onclick = function () {
        var i = Number(b.dataset.i), m = b.dataset.m;
        if (m === 'del') lista.splice(i, 1);
        else { var j = m === 'up' ? i - 1 : i + 1; if (j < 0 || j >= lista.length) return; var t = lista[i]; lista[i] = lista[j]; lista[j] = t; }
        pintarLista(); pintarResultados();
      };
    });
    var arrastrado = null;
    ul.querySelectorAll('.item').forEach(function (li) {
      li.ondragstart = function (e) { arrastrado = Number(li.dataset.i); li.classList.add('arrastrando'); e.dataTransfer.effectAllowed = 'move'; };
      li.ondragend = function () { li.classList.remove('arrastrando'); };
      li.ondragover = function (e) { e.preventDefault(); };
      li.ondrop = function (e) {
        e.preventDefault();
        var destino = Number(li.dataset.i);
        if (arrastrado == null || arrastrado === destino) return;
        var x = lista.splice(arrastrado, 1)[0]; lista.splice(destino, 0, x);
        pintarLista();
      };
    });
    actualizarConfirmar();
  }

  function pintarResultados() {
    var q = norm($('buscar').value.trim());
    var enLista = {}; lista.forEach(function (c) { enLista[c] = true; });
    var delProducto = producto && productos[producto] ? productos[producto].plantillas : [];
    var area = producto && productos[producto] ? productos[producto].area_codigo : null;
    var grupos = { mismo: [], area: [], otras: [] };
    cat.plantillas.forEach(function (p) {
      if (enLista[p.codigo]) return;
      if (q) {
        var hay = norm([p.nombre, p.codigo, p.descripcion, p.area_codigo, (p.palabras_clave || []).join(' ')].join(' '));
        if (!q.split(/\s+/).every(function (t) { return hay.indexOf(t) >= 0; })) return;
      }
      if (delProducto.indexOf(p.codigo) >= 0) grupos.mismo.push(p);
      else if (area && p.area_codigo === area) grupos.area.push(p);
      else grupos.otras.push(p);
    });
    var out = '';
    [['mismo', 'Del mismo producto'], ['area', 'Misma área'], ['otras', 'Otras plantillas']].forEach(function (g) {
      var arr = grupos[g[0]];
      if (!arr.length) return;
      out += '<div class="grupo">' + g[1] + ' (' + arr.length + ')</div>';
      arr.forEach(function (p) {
        out += '<div class="opcion' + (p.ejecutable ? '' : ' off') + '" data-c="' + esc(p.codigo) + '"><span>' + esc(p.nombre) + '<small>' + esc(p.area_codigo || '') + (p.descripcion ? ' · ' + esc(String(p.descripcion).slice(0, 110)) : '') + '</small></span>' + etiquetaPlantilla(p) + '</div>';
      });
    });
    $('resultados').innerHTML = out || '<div class="opcion off">No hay plantillas que coincidan.</div>';
    $('resultados').querySelectorAll('.opcion[data-c]').forEach(function (o) {
      o.onclick = function () {
        var p = plantillas[o.dataset.c];
        if (!p || !p.ejecutable) return;
        lista.push(o.dataset.c);
        pintarLista(); pintarResultados();
      };
    });
  }

  function problemas() {
    var m = [];
    if (!lista.length) m.push('El pedido necesita al menos un entregable.');
    lista.forEach(function (c) { var p = plantillas[c]; if (!p || !p.ejecutable) m.push('«' + (p ? p.nombre : c) + '»: ' + ((p && p.bloqueo) || 'no ejecutable') + '. Quítala de la lista.'); });
    return m;
  }

  function actualizarConfirmar() {
    var pr = problemas();
    $('confirmar').disabled = pr.length > 0;
    $('progreso').textContent = lista.length + ' entregable' + (lista.length === 1 ? '' : 's');
    $('avisos').innerHTML = pr.length ? '<div class="caja-err"><ul>' + pr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '';
    var add = lista.filter(function (c) { return inicial.indexOf(c) < 0; }), del = inicial.filter(function (c) { return lista.indexOf(c) < 0; });
    $('cambios').textContent = (add.length || del.length) ? ('Cambios respecto a la propuesta: ' + (add.length ? '+' + add.length + ' agregado(s) ' : '') + (del.length ? '−' + del.length + ' quitado(s)' : '')) : '';
  }


  var proyectosSel = {};
  function pintarProyectos() {
    var cont = $('proyectos');
    var lista = D.proyectos || [];
    if (!lista.length) { cont.innerHTML = '<p class="ayuda">Este cliente no tiene proyectos registrados: se usarán solo sus documentos generales.</p>'; return; }
    var asana = norm(P.proyecto_asana || '');
    lista.forEach(function (p) {
      var n = norm(p.nombre);
      proyectosSel[p.drive_folder_id] = Boolean(asana && (asana.indexOf(n) >= 0 || n.indexOf(asana) >= 0));
    });
    cont.innerHTML = lista.map(function (p) {
      return '<label class="chk-proy"><input type="checkbox" data-id="' + esc(p.drive_folder_id) + '"' + (proyectosSel[p.drive_folder_id] ? ' checked' : '') + '> <span>' + esc(p.nombre) + '</span>' + (p.anio ? ' <small>' + esc(p.anio) + '</small>' : '') + '</label>';
    }).join('');
    cont.querySelectorAll('input[type=checkbox]').forEach(function (c) {
      c.onchange = function () { proyectosSel[c.dataset.id] = c.checked; };
    });
  }
  function proyectosElegidos() {
    return (D.proyectos || []).filter(function (p) { return proyectosSel[p.drive_folder_id]; })
      .map(function (p) { return { drive_folder_id: p.drive_folder_id, nombre: p.nombre }; });
  }

  function propuestaMode() {
    propuesta();
    pintarProducto(); pintarLista(); pintarResultados(); pintarProyectos();
    $('buscar').oninput = pintarResultados;
    $('buscar').onfocus = pintarResultados;
    $('confirmar').onclick = function () {
      var elegidos = proyectosElegidos();
      if ((D.proyectos || []).length && !elegidos.length && !confirm('No marcaste ningún proyecto: TaloX buscará insumos solo en los documentos generales del cliente. ¿Continuar?')) return;
      var b = this; b.disabled = true; $('estado').className = 'msg'; $('estado').textContent = 'Confirmando…';
      var por = ($('por').value || '').trim() || 'consultor';
      try { localStorage.setItem('talox_nombre', por); } catch (e) {}
      post('pedido-confirmar', {
        pedido_id: P.pedido_id, producto: producto, por: por, proyectos: elegidos,
        entregables: lista.map(function (c) { return { plantilla_codigo: c }; })
      }).then(function (r) {
        if (r.ok) { $('estado').textContent = 'Pedido confirmado. TaloX empieza con el primer entregable.'; setTimeout(function () { location.reload(); }, 900); }
        else {
          var mot = r.j.motivos || [r.j.mensaje || 'No se pudo confirmar'];
          $('avisos').innerHTML = '<div class="caja-err"><ul>' + mot.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
          $('estado').textContent = ''; b.disabled = false;
        }
      }).catch(function (e) { $('estado').className = 'msg err'; $('estado').textContent = 'Error de red: ' + e.message; b.disabled = false; });
    };
    try { $('por').value = localStorage.getItem('talox_nombre') || P.solicitante_nombre || ''; } catch (e) { $('por').value = P.solicitante_nombre || ''; }
  }

  if (P.estado && P.estado !== 'producto_propuesto') gestion(); else propuestaMode();
})();
