// Alta del entregable: a qué producto pertenece, qué especialista lo produce y con qué datos se ofrece.
// Los catálogos (productos, áreas, especialistas con su descripción) vienen de la base; aquí no hay listas escritas.
(function () {
  var D = window.__DATOS__ || {};
  var AL = D.alta;
  var cont = document.getElementById('contAlta');
  if (!cont) return;
  if (!AL || AL.ok === false) {
    cont.innerHTML = '<div class="aviso-caja"><div>No se pudieron leer los datos de alta de esta plantilla. Recarga la página; si sigue igual, avisa al equipo de TaloX.</div></div>';
    window.AltaEntregable = { faltan: function () { return ['datos de alta']; }, guardar: function () { return Promise.reject(new Error('Sin datos de alta')); } };
    return;
  }

  var P = AL.plantilla || {};
  var SUG = AL.sugerida || null;
  var CAT = AL.catalogos || { productos: [], areas: [], especialistas: [], destinatarios: ['cliente', 'interno'] };
  var guardados = (AL.productos || []).map(function (p) { return p.codigo; });

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function vacio(v) { return v == null || String(v).trim() === ''; }
  function avisar() { document.dispatchEvent(new CustomEvent('alta-cambio')); }

  // Estado de la sección: lo guardado manda; lo que falta se completa con la sugerencia de TaloX (marcada como tal)
  var hayGuardado = guardados.length > 0 || !!P.workflow_id || !!P.especialista_solicitado || !vacio(P.area_codigo) || !vacio(P.descripcion_encuadre);
  var origen = { productos: false, especialista: false, area: false, destinatario: false, descripcion: false, palabras: false };
  var A = {
    productos: guardados.slice(),
    workflow_id: P.workflow_id || null,
    nueva: !!P.especialista_solicitado && !P.workflow_id,
    nota: P.especialista_nota || '',
    area: P.area_codigo || '',
    destinatario: hayGuardado ? (P.destinatario || '') : '',
    descripcion: P.descripcion_encuadre || '',
    palabras: (P.palabras_clave || []).join(', ')
  };
  if (SUG) {
    if (!A.productos.length && (SUG.productos || []).length) { A.productos = SUG.productos.slice(); origen.productos = true; }
    if (!A.workflow_id && !A.nueva) {
      if (SUG.workflow_id) { A.workflow_id = SUG.workflow_id; origen.especialista = true; }
      else if (SUG.especialista_nota) { A.nueva = true; A.nota = SUG.especialista_nota; origen.especialista = true; }
    }
    if (vacio(A.area) && SUG.area_codigo) { A.area = SUG.area_codigo; origen.area = true; }
    if (vacio(A.destinatario) && SUG.destinatario) { A.destinatario = SUG.destinatario; origen.destinatario = true; }
    if (vacio(A.descripcion) && SUG.descripcion_encuadre) { A.descripcion = SUG.descripcion_encuadre; origen.descripcion = true; }
    if (vacio(A.palabras) && (SUG.palabras_clave || []).length) { A.palabras = SUG.palabras_clave.join(', '); origen.palabras = true; }
  }
  if (vacio(A.destinatario)) A.destinatario = P.destinatario || 'cliente';

  function marca(k) { return origen[k] ? '<span class="id sugerido" title="TaloX propuso esto leyendo la plantilla y los catálogos; confirma o corrige.">sugerido por TaloX</span>' : ''; }

  function faltan() {
    var f = [];
    if (!A.productos.length) f.push('el producto');
    if (A.nueva || !A.workflow_id) f.push(A.nueva ? 'esperar el especialista nuevo' : 'el especialista');
    if (vacio(A.area)) f.push('el área');
    if (vacio(A.descripcion)) f.push('la descripción del entregable');
    return f;
  }

  function especialistaHtml() {
    var h = '<div class="opciones-lista">';
    (CAT.especialistas || []).forEach(function (e) {
      var on = !A.nueva && A.workflow_id === e.workflow_id;
      h += '<label class="opcion' + (on ? ' elegida' : '') + '"><input type="radio" name="alta-esp" value="' + esc(e.workflow_id) + '"' + (on ? ' checked' : '') + '>';
      h += '<span class="opcion-cuerpo"><b>' + esc(e.nombre) + '</b>';
      h += '<span class="d">' + esc(e.para_que_sirve || 'Sin descripción: pregunta al equipo de TaloX qué hace.') + '</span>';
      if (e.aplica_a) h += '<span class="d"><i>Aplica a:</i> ' + esc(e.aplica_a) + '</span>';
      if (e.no_aplica_a) h += '<span class="d"><i>No aplica a:</i> ' + esc(e.no_aplica_a) + '</span>';
      if (!e.descripcion_revisada) h += '<span class="d aviso-txt">Esta descripción es automática y todavía no fue revisada por el equipo.</span>';
      h += '</span></label>';
    });
    h += '<label class="opcion' + (A.nueva ? ' elegida' : '') + '"><input type="radio" name="alta-esp" value="__nuevo__"' + (A.nueva ? ' checked' : '') + '>';
    h += '<span class="opcion-cuerpo"><b>Ninguno aplica: pedir un especialista nuevo</b><span class="d">Queda registrado en la cola de mejoras de TaloX para que el equipo lo valide y lo construya. Mientras no exista, esta plantilla se guarda pero no se puede usar.</span></span></label>';
    h += '</div>';
    if (A.nueva) {
      h += '<div class="cmp" style="margin-top:10px;"><label class="t">Qué tendría que hacer el especialista nuevo</label><div class="hint" style="margin:2px 0 6px;">Con qué insumos trabajaría y qué resultado esperas. Es lo que lee el equipo para construirlo.</div><textarea id="alta-nota" rows="4">' + esc(A.nota) + '</textarea></div>';
    }
    return h;
  }

  function render() {
    var h = '';
    if (SUG && SUG.justificacion) h += '<div class="aviso-caja limpio"><h4>Qué propone TaloX y por qué</h4><p style="margin:0;font-size:13.5px;">' + esc(SUG.justificacion) + '</p></div>';
    if (!SUG && !hayGuardado) h += '<div class="aviso-caja"><div>TaloX no pudo proponer el alta de esta plantilla. Completa los datos a mano.</div></div>';
    if (P.especialista_solicitado && !P.workflow_id) h += '<div class="aviso-caja"><div>Ya se pidió un especialista nuevo para esta plantilla (está en la cola de mejoras de TaloX). Hasta que exista y lo elijas acá, la plantilla no se puede aprobar ni usar.</div></div>';

    h += '<div class="campo-card"><div class="campo-cab"><div><span class="etq">Producto</span>' + marca('productos') + '</div></div><div class="campo-cuerpo">';
    h += '<div class="hint">Marca uno o más productos de Xternum en los que se entrega este documento. Así TaloX lo ofrece cuando se pide ese producto.</div><div class="chips">';
    (CAT.productos || []).forEach(function (p) {
      var on = A.productos.indexOf(p.codigo) >= 0;
      h += '<label><input type="checkbox" data-alta-prod="' + esc(p.codigo) + '"' + (on ? ' checked' : '') + '> ' + esc(p.nombre) + '</label>';
    });
    h += '</div></div></div>';

    h += '<div class="campo-card"><div class="campo-cab"><div><span class="etq">Especialista que lo produce</span>' + marca('especialista') + '</div></div><div class="campo-cuerpo">';
    h += '<div class="hint">El especialista es el flujo de TaloX que redacta este entregable. Elige el que mejor encaje con lo que describe cada uno.</div>';
    h += '<div id="alta-esp-cont">' + especialistaHtml() + '</div></div></div>';

    h += '<div class="campo-card"><div class="campo-cab"><div><span class="etq">Datos con que se ofrece</span></div></div><div class="campo-cuerpo"><div class="fila">';
    h += '<div class="cmp"><label class="t">Área' + marca('area') + '</label><select id="alta-area"><option value="">(sin definir)</option>';
    (CAT.areas || []).forEach(function (a) { h += '<option value="' + esc(a.codigo) + '"' + (a.codigo === A.area ? ' selected' : '') + '>' + esc(a.nombre) + '</option>'; });
    h += '</select></div>';
    h += '<div class="cmp"><label class="t">Se entrega a' + marca('destinatario') + '</label><select id="alta-dest">';
    (CAT.destinatarios || []).forEach(function (d) { h += '<option value="' + esc(d) + '"' + (d === A.destinatario ? ' selected' : '') + '>' + (d === 'interno' ? 'Uso interno de Xternum' : 'El cliente') + '</option>'; });
    h += '</select></div></div>';
    h += '<div class="cmp"><label class="t">Para qué sirve este entregable' + marca('descripcion') + '</label><div class="hint" style="margin:2px 0 6px;">Qué es, en qué pedidos aplica y qué NO incluye. Es lo que TaloX lee para elegir entre plantillas parecidas.</div><textarea id="alta-desc" rows="4">' + esc(A.descripcion) + '</textarea></div>';
    h += '<div class="cmp"><label class="t">Palabras clave' + marca('palabras') + '</label><div class="hint" style="margin:2px 0 6px;">Términos con los que se nombraría este entregable en un pedido, separados por comas.</div><input type="text" id="alta-kw" value="' + esc(A.palabras) + '"></div>';
    h += '</div></div>';

    h += '<div class="fila-alta"><button type="button" class="boton-guardar" id="alta-guardar">💾 Guardar alta</button><span class="hint" id="alta-estado"></span></div>';
    cont.innerHTML = h;
  }

  function leerForm() {
    var a = $('alta-area'), d = $('alta-dest'), t = $('alta-desc'), k = $('alta-kw'), n = $('alta-nota');
    if (a) A.area = a.value; if (d) A.destinatario = d.value; if (t) A.descripcion = t.value; if (k) A.palabras = k.value; if (n) A.nota = n.value;
  }

  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.hasAttribute && t.hasAttribute('data-alta-prod')) {
      var c = t.getAttribute('data-alta-prod');
      A.productos = A.productos.filter(function (x) { return x !== c; });
      if (t.checked) A.productos.push(c);
      origen.productos = false; avisar(); return;
    }
    if (t.name === 'alta-esp') {
      leerForm();
      if (t.value === '__nuevo__') { A.nueva = true; A.workflow_id = null; } else { A.nueva = false; A.workflow_id = t.value; }
      origen.especialista = false;
      $('alta-esp-cont').innerHTML = especialistaHtml(); avisar(); return;
    }
    if (t.id === 'alta-area') { origen.area = false; } else if (t.id === 'alta-dest') { origen.destinatario = false; }
    if (t.id && t.id.indexOf('alta-') === 0) { leerForm(); avisar(); }
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'alta-desc' || t.id === 'alta-kw' || t.id === 'alta-nota') { leerForm(); avisar(); }
  });

  function cuerpo() {
    leerForm();
    var kw = A.palabras.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    var datos = {
      area_codigo: A.area || null,
      destinatario: A.destinatario || null,
      descripcion_encuadre: A.descripcion.trim() || null,
      palabras_clave: kw,
      workflow_id: A.nueva ? null : (A.workflow_id || null),
      especialista_nota: A.nueva ? A.nota.trim() : null,
      productos: A.productos.map(function (c, i) { return { codigo: c, orden: i + 1 }; })
    };
    return datos;
  }

  function guardar(quien) {
    if (A.nueva && vacio(A.nota)) return Promise.reject(new Error('Cuenta qué tendría que hacer el especialista nuevo.'));
    return fetch('https://inteligencia-xternum.app.n8n.cloud/webhook/guardar-alta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: D.file_id, datos: cuerpo(), por: quien || '' })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok || j.ok === false) throw new Error((j.motivos && j.motivos.join('; ')) || j.mensaje || 'Error del servidor');
        P.especialista_solicitado = !!j.especialista_solicitado;
        if (j.mejora_id) P.mejora_id = j.mejora_id;
        return j;
      });
    });
  }

  document.addEventListener('click', function (ev) {
    if (ev.target.id !== 'alta-guardar') return;
    var q = document.getElementById('validadoPor'); q = q ? q.value.trim() : '';
    var est = $('alta-estado'); est.textContent = 'Guardando...';
    guardar(q).then(function (j) {
      est.textContent = j.especialista_solicitado ? 'Guardado. El pedido del especialista nuevo quedó en la cola de mejoras de TaloX.' : 'Guardado.';
      avisar();
    }).catch(function (e) { est.textContent = ''; est.className = 'hint malo-txt'; est.textContent = 'No se pudo guardar: ' + e.message; });
  });

  window.AltaEntregable = { faltan: faltan, guardar: guardar };
  render();
  avisar();
})();
