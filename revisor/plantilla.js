(function () {
  var D = window.__DATOS__;
  var C = D.contrato;
  var ES = {};
  D.estandares.forEach(function (e) { ES[e.codigo] = e; });

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function opciones(mapa, actual) {
    var claves = Object.keys(mapa);
    if (actual && claves.indexOf(actual) < 0) claves.push(actual);
    var h = '<option value="">(sin definir)</option>';
    claves.forEach(function (k) { h += '<option value="' + esc(k) + '"' + (k === actual ? ' selected' : '') + '>' + esc(mapa[k] || k) + '</option>'; });
    return h;
  }
  var V = D.vocabulario || { origen: [], formato: [], perfil_flujo: [] };
  function mapaVoc(tipo) { var m = {}; (V[tipo] || []).forEach(function (v) { m[v.codigo] = v.etiqueta; }); return m; }
  function descVoc(tipo) { return (V[tipo] || []).map(function (v) { return '<b>' + esc(v.etiqueta) + '</b>: ' + esc(v.descripcion || ''); }).join(' '); }
  function etiquetaVoc(tipo, cod) { var r = (V[tipo] || []).filter(function (v) { return v.codigo === cod; })[0]; return r ? r : null; }
  var origenAbierto = {};
  function ayuda(t) { return '<div class="hint ayuda-campo">' + t + '</div>'; }
  function hoy() { return new Date().toISOString(); }
  function quien() { var v = $('validadoPor'); return v ? v.value.trim() : ''; }

  // ---- acceso a campos por ruta: "c:2" campo fijo; "b:1" bloque; "b:1:3" campo del bloque 1
  function obtener(ruta) {
    var p = ruta.split(':');
    if (p[0] === 'c') return C.campos[+p[1]];
    if (p[0] === 't') return C.tablas[+p[1]];
    if (p.length === 2) return C.bloques[+p[1]];
    return C.bloques[+p[1]].campos[+p[2]];
  }
  function idsDeAmbito(ruta) {
    var p = ruta.split(':');
    var lista = p[0] === 'c' ? C.campos : C.bloques[+p[1]].campos;
    return lista.map(function (c) { return c.id; });
  }
  function leerClave(o, k) { return k.split('.').reduce(function (a, b) { return a == null ? a : a[b]; }, o); }
  function fijarClave(o, k, v) {
    var p = k.split('.'); var cur = o;
    for (var i = 0; i < p.length - 1; i++) { if (cur[p[i]] == null || typeof cur[p[i]] !== 'object') cur[p[i]] = {}; cur = cur[p[i]]; }
    cur[p[p.length - 1]] = v;
  }

  function sugeridoHtml(c) {
    return (c.validacion && c.validacion.estado) === 'sugerido' ? '<span class="id sugerido" title="TaloX propuso estos valores a partir de la pauta del documento; revísalos antes de validar.">sugerido por TaloX</span>' : '';
  }
  function pendienteGlobal(k) { var o = C[k]; return !!(o && o.origen === 'sugerida'); }
  function globalesPendientes() { return ['perfil_flujo', 'objetivo_palabras', 'criterios_auditoria'].filter(pendienteGlobal); }

  function chips(ruta, c) {
    var h = '<div class="chips">';
    var ids = idsDeAmbito(ruta).filter(function (i) { return i !== c.id; });
    ['*'].concat(ids).forEach(function (i) {
      var on = (c.depende_de || []).indexOf(i) >= 0;
      h += '<label><input type="checkbox" data-ruta="' + ruta + '" data-dep="' + esc(i) + '"' + (on ? ' checked' : '') + '> ' + (i === '*' ? 'todos los demás' : esc(i)) + '</label>';
    });
    return h + '</div>';
  }
  function criteriosChips(ruta, c) {
    var h = '<div class="chips">';
    D.estandares.forEach(function (e) {
      var on = (c.criterios_auditoria || []).indexOf(e.codigo) >= 0;
      h += '<label title="' + esc(e.definicion) + '"><input type="checkbox" data-ruta="' + ruta + '" data-crit="' + esc(e.codigo) + '"' + (on ? ' checked' : '') + '> ' + esc(e.principio) + '</label>';
    });
    (c.criterios_auditoria || []).forEach(function (cod) {
      if (!ES[cod]) h += '<label><input type="checkbox" checked data-ruta="' + ruta + '" data-crit="' + esc(cod) + '"> ' + esc(cod) + ' (no está en el catálogo)</label>';
    });
    return h + '</div>';
  }
  function validadoHtml(ruta, c) {
    var v = (c.validacion && c.validacion.estado) === 'validado';
    var detalle = v && c.validacion.validado_por ? ' <span class="hint">por ' + esc(c.validacion.validado_por) + '</span>' : '';
    return '<label class="chk val"><input type="checkbox" data-ruta="' + ruta + '" data-validar="1"' + (v ? ' checked' : '') + '> Validado</label>' + detalle;
  }

  function campoHtml(ruta, c, esBloque) {
    var validado = (c.validacion && c.validacion.estado) === 'validado';
    var ext = c.extension_palabras && c.extension_palabras.valor != null ? c.extension_palabras.valor : '';
    var crit = c.criterios ? JSON.stringify(c.criterios, null, 2) : '';
    var con = c.conocimiento || {};
    var h = '<div class="campo-card' + (validado ? ' validado' : '') + '" data-card="' + ruta + '">';
    h += '<div class="campo-cab"><div><span class="etq">' + esc(c.etiqueta || c.id) + '</span><span class="id">' + esc(c.id) + '</span>' + sugeridoHtml(c);
    h += '</div><div>' + validadoHtml(ruta, c) + '</div></div>';
    h += '<div class="campo-cuerpo">';
    h += '<div class="ancla">' + esc(c.ancla || '') + '</div>';
    h += '<div class="cmp"><label class="t">Instrucción metodológica</label>' + ayuda('Es la consigna que recibe TaloX para redactar este campo. Escríbela como se la darías a un colega: qué debe incluir, con qué enfoque y qué evitar. Si el documento ya traía una pauta, aparece aquí; puedes ajustarla.') + '<textarea data-ruta="' + ruta + '" data-k="instruccion">' + esc(c.instruccion || '') + '</textarea></div>';
    h += '<div class="fila">';
    var ov = etiquetaVoc('origen', c.origen);
    if (!ov || origenAbierto[ruta]) {
      h += '<div class="cmp"><label class="t">Origen de la información</label>' + ayuda(descVoc('origen')) + '<select data-ruta="' + ruta + '" data-k="origen">' + opciones(mapaVoc('origen'), c.origen) + '</select></div>';
    } else {
      h += '<div class="cmp"><label class="t">Origen de la información</label><div><b>' + esc(ov.etiqueta) + '</b> <button type="button" class="mini" data-corregir-origen="' + ruta + '">Corregir</button></div>' + ayuda(esc(ov.descripcion || '') + ' Lo propone TaloX a partir del documento; corrígelo solo si no corresponde.') + '</div>';
    }
    h += '<div class="cmp"><label class="t">Formato</label>' + ayuda(descVoc('formato')) + '<select data-ruta="' + ruta + '" data-k="formato">' + opciones(mapaVoc('formato'), c.formato) + '</select></div>';
    h += '<div class="cmp"><label class="t">Extensión esperada (palabras)</label>' + ayuda('Cuántas palabras debería tener este campo, aproximadamente. Vacío: TaloX lo reparte según la extensión total del entregable.') + '<input type="number" min="0" data-ruta="' + ruta + '" data-k="extension" value="' + esc(ext) + '"></div>';
    h += '<div class="cmp"><label class="chk" title="Si está marcado, el entregable no se considera completo sin este campo."><input type="checkbox" data-ruta="' + ruta + '" data-k="obligatorio"' + (c.obligatorio ? ' checked' : '') + '> Obligatorio</label><br><label class="chk" title="Marca si TaloX debe buscar información en fuentes externas (web) para redactar este campo."><input type="checkbox" data-ruta="' + ruta + '" data-k="investigar"' + (c.investigar ? ' checked' : '') + '> Requiere investigación externa</label></div>';
    h += '</div>';
    h += '<div class="cmp"><label class="t">Se arma a partir de</label><div class="hint" style="margin:2px 0 6px;">Solo aplica si este campo se escribe resumiendo o combinando otros (ej: un resumen ejecutivo o un listado de fuentes). Marca de cuáles: TaloX redactará primero esos campos y luego armará este con lo ya escrito. Si el campo se redacta por sí solo, déjalo vacío.</div>' + chips(ruta, c) + '</div>';
    h += '<div class="fila">';
    h += '<div class="cmp"><label class="t">Metodología Xternum a consultar</label>' + ayuda('Nombre del modelo o método de Xternum que TaloX debe consultar para este campo.') + '<input type="text" data-ruta="' + ruta + '" data-k="conocimiento.metodologia" value="' + esc(con.metodologia || '') + '" placeholder="ej: PEST"></div>';
    h += '<div class="cmp" style="grid-column: span 2;"><label class="t">Qué buscar en el conocimiento</label>' + ayuda('Qué parte de esa metodología le sirve a este campo (opcional).') + '<input type="text" data-ruta="' + ruta + '" data-k="conocimiento.consulta" value="' + esc(con.consulta || '') + '" placeholder="ej: variables determinantes y escalas"></div>';
    h += '</div>';
    h += '<div class="cmp"><label class="t">Criterios de auditoría que aplican a este campo</label>' + ayuda('Con qué principios de calidad revisará el auditor este campo. Pasa el cursor sobre cada uno para ver su definición.') + criteriosChips(ruta, c) + '</div>';
    h += '</div></div>';
    return h;
  }

  function tablaHtml(ruta, t) {
    var validado = (t.validacion && t.validacion.estado) === 'validado';
    var cols = (t.columnas || []).map(function (k) { return esc(k.nombre); }).join(' · ');
    var h = '<div class="campo-card' + (validado ? ' validado' : '') + '" data-card="' + ruta + '">';
    h += '<div class="campo-cab"><div><span class="etq">Tabla: ' + esc(t.etiqueta || t.id) + '</span><span class="id">' + esc(t.id) + '</span>' + sugeridoHtml(t) + '</div><div>' + validadoHtml(ruta, t) + '</div></div>';
    h += '<div class="campo-cuerpo"><div class="ancla">' + esc(t.ancla || '') + '</div>';
    h += '<div class="cmp"><label class="t">Columnas</label><div class="hint">' + (cols || '(sin columnas detectadas)') + '</div></div>';
    h += '<div class="cmp"><label class="t">Instrucción de la tabla</label>' + ayuda('Consigna que recibe TaloX para completar esta tabla: qué filas incluir, qué debe ir en cada columna y qué evitar.') + '<textarea data-ruta="' + ruta + '" data-k="instruccion">' + esc(t.instruccion || '') + '</textarea></div>';
    h += '<div class="cmp"><label class="chk"><input type="checkbox" data-ruta="' + ruta + '" data-k="obligatorio"' + (t.obligatorio ? ' checked' : '') + '> Obligatoria</label></div>';
    return h + '</div></div>';
  }

  function avisoGlobalHtml() {
    var p = globalesPendientes();
    if (!p.length) return '';
    return '<div class="aviso-caja"><h4>TaloX propuso estos datos generales</h4><p style="margin:0 0 8px;font-size:13.5px;">Revísalos (puedes cambiarlos) y confírmalos para poder aprobar la plantilla.</p><button type="button" class="boton-iterar" id="confirmarGlobales">✓ Confirmar datos generales propuestos por TaloX</button></div>';
  }

  function globalHtml() {
    var pf = C.perfil_flujo || {};
    var h = avisoGlobalHtml() + '<div class="global-grid">';
    var PERFILES = mapaVoc('perfil_flujo');
    h += '<div class="cmp"><label class="t">' + esc(pf.pregunta || '¿De dónde sale la información de este entregable?') + '</label>' + ayuda('Define cómo se produce el entregable completo. Es la decisión más importante de la plantilla: determina si TaloX investiga fuera, trabaja con lo que aportan ustedes o solo ordena un material existente.') + '<select data-g="perfil_flujo.valor">' + opciones(PERFILES, pf.valor || '') + '</select></div>';
    h += '<div class="cmp"><label class="t">Extensión esperada del entregable (palabras)</label>' + ayuda('Cuántas palabras debería tener el documento completo, aproximadamente. TaloX la reparte entre los campos.') + '<input type="number" min="0" data-g="objetivo_palabras.valor" value="' + esc(C.objetivo_palabras && C.objetivo_palabras.valor != null ? C.objetivo_palabras.valor : '') + '"></div>';
    h += '</div>';
    h += '<div class="cmp" style="margin-top:14px;"><label class="t">Criterios de auditoría del entregable</label>' + ayuda('Principios de calidad con que se revisa el documento completo. Marca “no negociable” los que, si no se cumplen, impiden aprobarlo.');
    D.estandares.forEach(function (e, i) {
      var ap = (C.criterios_auditoria.aplican || []).filter(function (a) { return a.codigo === e.codigo; })[0];
      h += '<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;padding:4px 0;"><label class="chk" title="' + esc(e.definicion) + '"><input type="checkbox" data-gcrit="' + esc(e.codigo) + '"' + (ap ? ' checked' : '') + '> ' + esc(e.principio) + '</label>';
      h += '<label class="chk"><input type="checkbox" data-gnn="' + esc(e.codigo) + '"' + (ap && ap.no_negociable ? ' checked' : '') + '> no negociable</label></div>';
    });
    h += '</div>';
    return h;
  }

  function reglasHtml() {
    var h = '<div class="reglas">';
    (C.reglas_coherencia || []).forEach(function (r, i) {
      h += '<div class="regla"><div class="cmp"><label class="t">Regla de coherencia entre campos</label>' + ayuda('Una condición que debe cumplirse entre varios campos a la vez. Ej: «PEST y Porter deben ser complementarios, no redundantes».') + '<textarea data-regla="' + i + '" data-rk="regla">' + esc(r.regla || '') + '</textarea></div>';
      h += '<div class="fila"><div class="cmp"><label class="t">Cómo se verifica</label>' + ayuda('Cómo comprobará el auditor que se cumple.') + '<input type="text" data-regla="' + i + '" data-rk="validacion" value="' + esc(r.validacion || '') + '"></div>';
      h += '<div class="cmp"><label class="t">Campos involucrados</label>' + ayuda('Códigos de los campos que intervienen, separados por coma (se ven en gris junto al nombre de cada campo).') + '<input type="text" data-regla="' + i + '" data-rk="campos" value="' + esc((r.campos || []).join(', ')) + '"></div>';
      h += '<div><button type="button" class="mini" data-quitar-regla="' + i + '">Quitar regla</button></div></div></div>';
    });
    h += '</div><p><button type="button" class="boton-iterar" id="agregarRegla">+ Agregar regla</button></p>';
    return h;
  }

  function render() {
    var h = '';
    C.campos.forEach(function (c, i) { h += campoHtml('c:' + i, c, false); });
    $('listaCampos').innerHTML = h || '<p class="hint">El documento no declara campos fijos.</p>';
    var hb = '';
    C.bloques.forEach(function (b, bi) {
      var validado = (b.validacion && b.validacion.estado) === 'validado';
      hb += '<div class="bloque-card"><div class="campo-cab" style="margin:0 -16px;"><div><span class="etq">Bloque dinámico: ' + esc(b.etiqueta || b.id) + '</span>' + (b.padre ? '<span class="id">dentro de ' + esc(b.padre) + '</span>' : '') + (b.multiplicidad ? '<span class="id">repeticiones ' + esc(b.multiplicidad) + '</span>' : '') + '<span class="id">' + esc(b.ancla_apertura || '') + ' … ' + esc(b.ancla_cierre || '') + '</span></div><div>' + validadoHtml('b:' + bi, b) + '</div></div>';
      hb += '<div class="cmp" style="margin-top:12px;"><label class="t">Instrucción del bloque</label><textarea data-ruta="b:' + bi + '" data-k="instruccion">' + esc(b.instruccion || '') + '</textarea></div>';
      (b.campos || []).forEach(function (c, ci) { hb += campoHtml('b:' + bi + ':' + ci, c, true); });
      hb += '</div>';
    });
    (C.tablas || []).forEach(function (t, ti) { hb += tablaHtml('t:' + ti, t); });
    $('listaBloques').innerHTML = hb || '<p class="hint">Esta plantilla no tiene bloques dinámicos ni tablas.</p>';
    avisosEditor();
    $('contGlobal').innerHTML = globalHtml();
    $('contReglas').innerHTML = reglasHtml();
    actualizarProgreso();
  }

  function avisosEditor() {
    var a = [];
    if (!D.workflow_id) a.push('Esta plantilla no tiene un especialista (flujo) asignado: aunque se apruebe, ningún agente la usará todavía.');
    var sg = C.plantilla && C.plantilla.sugerencia;
    if (sg && sg.estado && sg.estado !== 'ok') a.push('La sugerencia automática de TaloX quedó ' + esc(sg.estado) + (sg.motivo ? ' (' + esc(sg.motivo) + ')' : '') + ': lo que falta aparece sin definir.');
    var pend = todos().filter(function (x) { return x.o.validacion && x.o.validacion.estado === 'sugerido'; }).length;
    if (pend) a.push(pend + ' elemento(s) fueron sugeridos por TaloX y esperan tu revisión. Usa “Mostrar solo lo pendiente” para ir directo a ellos.');
    var el = $('avisosEditor');
    if (el) el.innerHTML = a.length ? '<div class="aviso-caja">' + a.map(function (x) { return '<div>' + x + '</div>'; }).join('') + '</div>' : '';
  }

  // ---- estado de validación
  function todos() {
    var l = [];
    C.campos.forEach(function (c, i) { l.push({ ruta: 'c:' + i, o: c, campo: true }); });
    C.bloques.forEach(function (b, bi) {
      l.push({ ruta: 'b:' + bi, o: b, campo: false });
      (b.campos || []).forEach(function (c, ci) { l.push({ ruta: 'b:' + bi + ':' + ci, o: c, campo: true }); });
    });
    (C.tablas || []).forEach(function (t, ti) { l.push({ ruta: 't:' + ti, o: t, campo: false }); });
    return l;
  }
  function completo(x) { return !x.campo || (x.o.origen && x.o.formato); }
  function estado() {
    var l = todos();
    var val = l.filter(function (x) { return x.o.validacion && x.o.validacion.estado === 'validado'; }).length;
    var faltaDef = l.filter(function (x) { return !completo(x); }).length;
    var perfil = C.perfil_flujo && C.perfil_flujo.valor;
    var gp = globalesPendientes().length;
    return { total: l.length, validados: val, faltaDef: faltaDef, perfil: !!perfil, globales: gp, listo: l.length > 0 && val === l.length && faltaDef === 0 && !!perfil && gp === 0 };
  }
  function actualizarProgreso() {
    var e = estado();
    var p = $('progreso');
    var txt = e.validados + ' de ' + e.total + ' elementos validados';
    if (!e.perfil) txt += ' · falta el perfil de flujo';
    if (e.globales) txt += ' · faltan confirmar datos generales';
    if (e.faltaDef) txt += ' · ' + e.faltaDef + ' sin origen o formato';
    p.textContent = txt;
    p.className = 'progreso' + (e.listo ? ' ok' : '');
    var b = $('btnAprobar');
    if (b) { b.disabled = !e.listo; b.title = e.listo ? '' : 'Valida todos los elementos, define origen, formato y perfil de flujo y confirma los datos generales propuestos'; }
  }
  function invalidar(o) {
    if (o.validacion && o.validacion.estado === 'validado') { o.validacion = { estado: 'editado', validado_por: null, validado_el: null }; return true; }
    return false;
  }
  function refrescarTarjeta(ruta) {
    var card = document.querySelector('[data-card="' + ruta + '"]');
    if (card) {
      var o = obtener(ruta);
      card.classList.toggle('validado', !!(o.validacion && o.validacion.estado === 'validado'));
      var cb = card.querySelector('[data-validar]');
      if (cb) cb.checked = !!(o.validacion && o.validacion.estado === 'validado');
    }
  }

  // ---- eventos
  function alCambiar(ev) {
    var t = ev.target;
    var ruta = t.getAttribute('data-ruta');
    if (ruta) {
      var o = obtener(ruta);
      if (t.hasAttribute('data-validar')) {
        if (t.checked) {
          if (!quien()) { alert('Escribe tu nombre en el pie de la página antes de validar.'); t.checked = false; return; }
          o.validacion = { estado: 'validado', validado_por: quien(), validado_el: hoy() };
        } else {
          o.validacion = { estado: 'editado', validado_por: null, validado_el: null };
        }
        refrescarTarjeta(ruta); actualizarProgreso(); return;
      }
      var cambio = false;
      if (t.hasAttribute('data-dep')) {
        var id = t.getAttribute('data-dep'); var l = (o.depende_de || []).filter(function (x) { return x !== id; });
        if (t.checked) l.push(id); o.depende_de = l; cambio = true;
      } else if (t.hasAttribute('data-crit')) {
        var cod = t.getAttribute('data-crit'); var lc = (o.criterios_auditoria || []).filter(function (x) { return x !== cod; });
        if (t.checked) lc.push(cod); o.criterios_auditoria = lc; cambio = true;
      } else {
        var k = t.getAttribute('data-k');
        if (k === 'extension') {
          var n = t.value.trim() === '' ? null : Number(t.value);
          o.extension_palabras = n == null ? null : { valor: n, origen: 'consultor' }; cambio = true;
        } else if (k === 'criterios') {
          var txt = t.value.trim();
          if (txt === '') { delete o.criterios; t.classList.remove('malo'); cambio = true; }
          else { try { o.criterios = JSON.parse(txt); t.classList.remove('malo'); cambio = true; } catch (e) { t.classList.add('malo'); return; } }
        } else if (k === 'conocimiento.metodologia' || k === 'conocimiento.consulta') {
          var conoc = o.conocimiento || { metodologia: null, consulta: null };
          conoc[k.split('.')[1]] = t.value.trim() === '' ? null : t.value;
          conoc.origen = 'consultor';
          o.conocimiento = (conoc.metodologia == null && conoc.consulta == null) ? null : conoc; cambio = true;
        } else if (t.type === 'checkbox') { o[k] = t.checked; cambio = true; }
        else { o[k] = t.value === '' ? null : t.value; if (k === 'instruccion') o[k] = t.value; cambio = true; }
      }
      if (cambio && invalidar(o)) refrescarTarjeta(ruta);
      actualizarProgreso(); return;
    }
    if (t.hasAttribute('data-g')) {
      var kk = t.getAttribute('data-g');
      var v = t.type === 'number' ? (t.value.trim() === '' ? null : Number(t.value)) : (t.value.trim() === '' ? null : t.value.trim());
      fijarClave(C, kk, v); fijarClave(C, kk.split('.')[0] + '.origen', 'consultor'); actualizarProgreso(); return;
    }
    if (t.hasAttribute('data-gcrit') || t.hasAttribute('data-gnn')) {
      var cod2 = t.getAttribute('data-gcrit') || t.getAttribute('data-gnn');
      var ap = C.criterios_auditoria.aplican.filter(function (a) { return a.codigo === cod2; })[0];
      if (t.hasAttribute('data-gcrit')) {
        if (t.checked && !ap) C.criterios_auditoria.aplican.push({ codigo: cod2, no_negociable: false });
        if (!t.checked) C.criterios_auditoria.aplican = C.criterios_auditoria.aplican.filter(function (a) { return a.codigo !== cod2; });
      } else {
        if (!ap) { ap = { codigo: cod2, no_negociable: false }; C.criterios_auditoria.aplican.push(ap); }
        ap.no_negociable = t.checked;
      }
      C.criterios_auditoria.origen = 'consultor'; render(); return;
    }
    if (t.hasAttribute('data-regla')) {
      var r = C.reglas_coherencia[+t.getAttribute('data-regla')]; var rk = t.getAttribute('data-rk');
      r[rk] = rk === 'campos' ? t.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : t.value;
    }
  }
  function alClick(ev) {
    var t = ev.target;
    if (t.hasAttribute('data-corregir-origen')) { origenAbierto[t.getAttribute('data-corregir-origen')] = true; render(); return; }
    if (t.id === 'confirmarGlobales') {
      globalesPendientes().forEach(function (k) { C[k].origen = 'validada'; });
      render(); return;
    }
    if (t.hasAttribute('data-quitar-regla')) {
      C.reglas_coherencia.splice(+t.getAttribute('data-quitar-regla'), 1); render();
    } else if (t.id === 'agregarRegla') {
      C.reglas_coherencia.push({ regla: '', validacion: '', campos: [] }); render();
    }
  }

  function bloquear(msg) {
    document.querySelectorAll('.boton, .boton-rechazo, .boton-iterar, .boton-guardar').forEach(function (b) { b.disabled = true; });
    if (msg) $('estadoAccion').textContent = msg;
  }
  function desbloquear() {
    document.querySelectorAll('.boton, .boton-rechazo, .boton-iterar, .boton-guardar').forEach(function (b) { b.disabled = false; });
    $('estadoAccion').textContent = ''; actualizarProgreso();
  }
  function confirmar(titulo, mensaje, exito) {
    $('contenido').innerHTML = '<div class="confirmacion"><div class="' + (exito ? 'tilde' : 'cruz') + '">' + (exito ? '✓' : '✕') + '</div><h2>' + titulo + '</h2><p>' + mensaje + '</p></div>';
    var pie = document.querySelector('.pie'); if (pie) pie.remove(); window.scrollTo(0, 0);
  }
  function llamar(ruta, cuerpo) {
    return fetch('https://inteligencia-xternum.app.n8n.cloud/webhook/' + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok || j.ok === false) throw new Error(j.mensaje || 'Error del servidor'); return j; }); });
  }
  function guardar() {
    if (!quien()) { alert('Escribe tu nombre en el pie de la página.'); return Promise.reject(new Error('sin nombre')); }
    return llamar('guardar-contrato', { file_id: D.file_id, contrato: C, validado_por: quien(), cargado_el: D.actualizado_el || null })
      .then(function (j) { if (j.actualizado_el) D.actualizado_el = j.actualizado_el; return j; });
  }

  window.guardarContrato = function () {
    bloquear('Guardando contrato...');
    guardar().then(function (j) { desbloquear(); $('estadoAccion').textContent = 'Guardado (' + j.contrato_estado + ')'; })
      .catch(function (e) { desbloquear(); if (e.message !== 'sin nombre') alert('No se pudo guardar: ' + e.message); });
  };
  window.enviarAprobacion = function () {
    bloquear('Guardando y aprobando...');
    guardar().then(function () { return llamar('aprobar-plantilla', { file_id: D.file_id, estado: 'aprobado' }); })
      .then(function () { confirmar('¡Plantilla Aprobada!', 'El contrato quedó validado y la plantilla disponible para los agentes redactores en producción.', true); })
      .catch(function (e) { desbloquear(); if (e.message !== 'sin nombre') alert('No se pudo aprobar: ' + e.message); });
  };
  window.iniciarRechazo = function () {
    var m = prompt('Motivo del rechazo:'); if (!m) return;
    bloquear('Registrando rechazo...');
    llamar('rechazar-plantilla', { file_id: D.file_id, motivo: m })
      .then(function () { confirmar('Plantilla Rechazada', 'Se registró el rechazo con las observaciones para su corrección.', false); })
      .catch(function (e) { alert('Error: ' + e.message); desbloquear(); });
  };
  window.solicitarReauditoria = function () {
    if (!confirm('TaloX va a leer de nuevo el documento en Drive y a procesarlo otra vez: conserva lo que ya validaste y no cambió, y propone lo nuevo. Los cambios que no guardaste en esta página se pierden. ¿Continuar?')) return;
    bloquear('TaloX está procesando de nuevo el documento (puede tardar un minuto)...');
    llamar('reauditar-plantilla', { file_id: D.file_id })
      .then(function () { location.reload(); })
      .catch(function (e) { alert('No se pudo procesar de nuevo el documento: ' + e.message); desbloquear(); });
  };

  document.addEventListener('change', function (ev) {
    if (ev.target.id === 'soloPendiente') document.body.classList.toggle('solo-pendiente', ev.target.checked);
  });
  document.addEventListener('change', alCambiar);
  document.addEventListener('click', alClick);
  try { var g = localStorage.getItem('talox_revisor'); if (g) $('validadoPor').value = g; } catch (e) {}
  $('validadoPor').addEventListener('input', function () { try { localStorage.setItem('talox_revisor', this.value); } catch (e) {} });
  render();
})();
