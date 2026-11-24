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
  // El HTML del flujo trae <main class="cuerpo">; se adapta al patrón HITL (#contenido > .cuerpo) para poder mostrar la pantalla final.
  (function () { var m = document.querySelector('main.cuerpo'); if (m && !document.getElementById('contenido')) { m.id = 'contenido'; m.className = ''; m.innerHTML = '<div class="cuerpo">' + m.innerHTML + '</div>'; } })();
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var ESTADOS = { pendiente: ['Pendiente', 'azul'], en_curso: ['En curso', 'ambar'], aprobado: ['Aprobado', 'verde'], rechazado: ['Rechazado', 'rojo'], fallido: ['Falló', 'rojo'], salteado: ['Salteado', ''] };

  function post(ruta, cuerpo) {
    return fetch(WH + '/' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j.ok !== false, j: j }; }); });
  }

  /* ---------- Pantalla final (mismo patrón que el resto de HITL) ---------- */
  function confirmar(titulo, mensaje, exito, extra) {
    $('contenido').innerHTML = '<div class="confirmacion"><div class="' + (exito ? 'tilde' : 'cruz') + '">' + (exito ? '✓' : '✕') + '</div><h2>' + titulo + '</h2><p>' + mensaje + '</p>' + (extra || '') + '</div>';
    var pie = $('pie'); if (pie) pie.remove();
    window.scrollTo(0, 0);
  }

  /* ---------- Modo gestión (pedido ya confirmado) ---------- */
  var ETAPAS = {
    iniciado: 'Preparando el encargo', triage_completado: 'Analizando insumos del cliente',
    hitl1_pendiente: 'Esperando tu aprobación del encuadre', hitl1_aprobado: 'Encuadre aprobado: redactando',
    hitl1_iterando: 'Ajustando el encuadre', en_redaccion_especialista: 'Redactando el borrador',
    en_auditoria_calidad: 'En auditoría de calidad', hitl2_pendiente: 'Esperando tu revisión del borrador',
    hitl2_aprobado: 'Borrador aprobado: generando el documento', finalizado_con_exito: 'Documento listo',
    cancelado: 'Cancelado', error_sistema: 'Error del sistema', error_especialista: 'Error en la redacción'
  };

  function recordarNombre(v) { try { if (v != null) localStorage.setItem('talox_nombre', v); return localStorage.getItem('talox_nombre') || ''; } catch (e) { return ''; } }

  function listaEntregables(ents, conAcciones) {
    var html = '<ul class="lista">';
    ents.forEach(function (e) {
      var st = ESTADOS[e.estado] || [e.estado, ''];
      var acciones = '';
      if (conAcciones && P.estado === 'pausado' && (e.estado === 'rechazado' || e.estado === 'fallido')) {
        acciones = '<button class="mini" data-a="rehacer" data-o="' + e.orden + '">Rehacer</button> <button class="mini" data-a="saltear" data-o="' + e.orden + '">Saltear</button>';
      }
      var etapa = (conAcciones && e.estado === 'en_curso' && e.solicitud_estado) ? '<small><strong>' + esc(ETAPAS[e.solicitud_estado] || e.solicitud_estado) + '</strong>' + (e.enlace_aprobacion ? ' · <a href="' + esc(e.enlace_aprobacion) + '" target="_blank">Abrir para revisar y aprobar ↗</a>' : '') + '</small>' : '';
      html += '<li class="item"><span class="orden">' + e.orden + '</span><span class="nombre">' + esc(e.plantilla_nombre || e.plantilla_codigo) + etapa +
        '<small>' + esc(e.notas || '') + (e.documento_url ? ' <a href="' + esc(e.documento_url) + '" target="_blank">Abrir documento ↗</a>' : '') + '</small></span>' +
        '<span class="etq ' + st[1] + '">' + esc(st[0]) + '</span>' + acciones + '</li>';
    });
    return html + '</ul>';
  }

  function gestion() {
    var ents = D.entregables || [];
    $('titulo-paso').textContent = 'Seguimiento del pedido · Producción de entregables';

    if (P.estado === 'cancelado') {
      confirmar('Pedido Cancelado', 'El pedido ha quedado detenido definitivamente: los entregables pendientes no se producirán.', false, listaEntregables(ents, false));
      return;
    }
    if (P.estado === 'completado') {
      confirmar('¡Pedido Completado!', 'Todos los entregables del pedido fueron producidos y aprobados.', true, listaEntregables(ents, false));
      return;
    }

    var total = ents.length;
    var actual = ents.filter(function (e) { return e.estado === 'en_curso'; })[0];
    var hechos = ents.filter(function (e) { return e.estado === 'aprobado' || e.estado === 'salteado'; }).length;
    var aviso;
    if (P.estado === 'pausado') {
      aviso = '<div class="aviso-caja"><h4>⏸ Pedido en pausa</h4><p>Un entregable fue rechazado o falló. Elige qué hacer con él: <strong>Rehacer</strong> lo vuelve a producir, <strong>Saltear</strong> continúa con el siguiente, o cancela el pedido.</p></div>';
    } else if (actual && actual.enlace_aprobacion) {
      aviso = '<div class="aviso-caja"><h4>⏳ Hace falta tu decisión</h4><p><strong>' + esc(ETAPAS[actual.solicitud_estado] || actual.solicitud_estado) + '</strong> · <a href="' + esc(actual.enlace_aprobacion) + '" target="_blank">Abrir para revisar y aprobar ↗</a></p></div>';
    } else {
      aviso = '<div class="aviso-caja limpio"><h4>✓ Pedido en producción</h4><p>' + (actual ? 'TaloX trabaja en el entregable ' + actual.orden + ' de ' + total + ': <strong>' + esc(ETAPAS[actual.solicitud_estado] || 'en curso') + '</strong>.' : 'TaloX está preparando el siguiente entregable.') + ' Llevas ' + hechos + ' de ' + total + ' resueltos.</p></div>';
    }

    $('contenido').innerHTML = '<div class="cuerpo"><section class="seccion"><h2><span class="num">1</span>Estado del pedido</h2>' +
      '<p class="ayuda">Los entregables se producen uno después del otro; cada uno aprobado alimenta al siguiente. Esta pantalla se actualiza sola cada 15 segundos.</p>' +
      aviso + '</section><section class="seccion"><h2><span class="num">2</span>Entregables, en orden</h2>' + listaEntregables(ents, true) + '<div id="msg" class="msg"></div></section></div>';

    var pie = $('pie');
    pie.innerHTML = '<div class="pie-interior" id="pie-gestion"></div>';
    var confirmando = false;
    var por = function () { var v = ($('por-g') ? $('por-g').value : '').trim() || 'consultor'; recordarNombre(v); return v; };
    var aviso_ = function (t) { $('msg').className = 'msg err'; $('msg').textContent = t; };

    function pintarPie() {
      confirmando = false;
      $('pie-gestion').innerHTML = '<div class="quien"><label for="por-g">Quién decide:</label><input type="text" id="por-g" placeholder="tu nombre"></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="boton-iterar" id="actualizar">🔄 Actualizar ahora</button><button type="button" class="boton-rechazo" id="cancelar">✕ Cancelar Pedido</button></div>';
      $('por-g').value = recordarNombre();
      $('actualizar').onclick = function () { location.reload(); };
      $('cancelar').onclick = pedirConfirmacion;
    }
    function pedirConfirmacion() {
      confirmando = true;
      var v = ($('por-g') ? $('por-g').value : '');
      $('pie-gestion').innerHTML = '<div class="iteracion-caja"><span>¿Cancelar el pedido? Los entregables pendientes no se producirán.</span>' +
        '<input type="text" id="por-g" placeholder="tu nombre" style="max-width:200px">' +
        '<input type="text" id="motivo-g" placeholder="Motivo (opcional)" maxlength="300" style="flex:1;min-width:200px">' +
        '<button type="button" class="boton-iterar" id="no-cancelar">Volver</button><button type="button" class="boton-rechazo" id="si-cancelar">✕ Sí, cancelar pedido</button></div>';
      $('por-g').value = v || recordarNombre();
      $('no-cancelar').onclick = pintarPie;
      $('si-cancelar').onclick = function () {
        var bt = $('si-cancelar'); bt.disabled = true; bt.textContent = 'Cancelando pedido...';
        post('pedido-accion', { pedido_id: P.pedido_id, accion: 'cancelar', por: por(), motivo: ($('motivo-g') ? $('motivo-g').value : '').trim() }).then(function (r) {
          if (r.ok) confirmar('Pedido Cancelado', 'El pedido ha quedado detenido definitivamente: los entregables pendientes no se producirán.', false);
          else { aviso_(r.j.motivo || 'No se pudo cancelar'); bt.disabled = false; bt.textContent = '✕ Sí, cancelar pedido'; }
        }).catch(function () { aviso_('No hubo respuesta del servidor. Intenta de nuevo.'); bt.disabled = false; bt.textContent = '✕ Sí, cancelar pedido'; });
      };
    }
    pintarPie();

    document.querySelectorAll('[data-a]').forEach(function (b) {
      b.onclick = function () {
        b.disabled = true;
        post('pedido-accion', { pedido_id: P.pedido_id, accion: b.dataset.a, orden: Number(b.dataset.o), por: por() }).then(function (r) {
          if (r.ok) location.reload(); else { aviso_(r.j.motivo || 'No se pudo aplicar la acción'); b.disabled = false; }
        }).catch(function () { aviso_('No hubo respuesta del servidor. Intenta de nuevo.'); b.disabled = false; });
      };
    });

    setInterval(function () {
      if (confirmando || document.activeElement === $('por-g')) return;
      location.reload();
    }, 15000);
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
      if (producto && productos[producto]) {
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
    var pre = [], otros = [];
    lista.forEach(function (p) {
      var n = norm(p.nombre);
      var sel = Boolean(asana && (asana.indexOf(n) >= 0 || n.indexOf(asana) >= 0));
      proyectosSel[p.drive_folder_id] = sel;
      (sel ? pre : otros).push(p);
    });
    var item = function (p) {
      return '<label class="chk-proy"><input type="checkbox" data-id="' + esc(p.drive_folder_id) + '"' + (proyectosSel[p.drive_folder_id] ? ' checked' : '') + '> <span>' + esc(p.nombre) + '</span>' + (p.anio ? ' <small>' + esc(p.anio) + '</small>' : '') + '</label>';
    };
    var html = '';
    if (pre.length) {
      html += '<p class="ayuda">Según la tarea de Asana, este pedido corresponde a:</p>' + pre.map(item).join('') +
        '<p class="ayuda">Valida que sea el correcto. Si no lo es, desmárcalo y elige otro.</p>';
    } else {
      html += '<div class="aviso-caja"><h4>No pude identificar el proyecto</h4><p>La tarea de Asana no coincide con ninguno de los proyectos registrados del cliente. Elige al menos uno de la lista.</p></div>';
    }
    if (otros.length) {
      html += '<details class="otros-proy"' + (pre.length ? '' : ' open') + '><summary>' +
        (pre.length ? 'Ver otros proyectos del cliente (' + otros.length + ') por si hace falta sumar alguno' : 'Proyectos del cliente (' + otros.length + ')') +
        '</summary>' + otros.map(item).join('') + '</details>';
    }
    cont.innerHTML = html;
    cont.querySelectorAll('input[type=checkbox]').forEach(function (c) {
      c.onchange = function () { proyectosSel[c.dataset.id] = c.checked; };
    });
  }
  function proyectosElegidos() {
    return (D.proyectos || []).filter(function (p) { return proyectosSel[p.drive_folder_id]; })
      .map(function (p) { return { drive_folder_id: p.drive_folder_id, nombre: p.nombre }; });
  }

  function propuestaMode() {
    var sinProyectoOk = false;
    propuesta();
    pintarProducto(); pintarLista(); pintarResultados(); pintarProyectos();
    $('buscar').oninput = pintarResultados;
    $('buscar').onfocus = pintarResultados;
    $('confirmar').onclick = function () {
      var elegidos = proyectosElegidos();
      if ((D.proyectos || []).length && !elegidos.length && !sinProyectoOk) {
        sinProyectoOk = true;
        $('avisos').innerHTML = '<div class="caja-err">No marcaste ningún proyecto de Drive: TaloX buscará insumos solo en los documentos generales del cliente. Marca un proyecto, o vuelve a pulsar <strong>Confirmar pedido</strong> para continuar así.</div>';
        return;
      }
      var b = this; b.disabled = true; $('estado').className = 'msg'; $('estado').textContent = 'Confirmando…';
      var por = ($('por').value || '').trim() || 'consultor';
      try { localStorage.setItem('talox_nombre', por); } catch (e) {}
      post('pedido-confirmar', {
        pedido_id: P.pedido_id, producto: producto, por: por, proyectos: elegidos,
        entregables: lista.map(function (c) { return { plantilla_codigo: c }; })
      }).then(function (r) {
        if (r.ok) { confirmar('¡Pedido Confirmado!', 'El pedido fue validado y TaloX empieza con el primer entregable. Podrás seguir el avance y aprobar cada etapa desde esta misma página.', true, '<p><button type="button" class="boton" id="ver-seg">Ver seguimiento del pedido</button></p>'); $('ver-seg').onclick = function () { location.reload(); }; }
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
