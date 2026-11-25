// Descripciones de los especialistas de TaloX, redactadas para el consultor: qué hace, a qué entregables aplica y a cuáles no.
// Los datos vienen de la base (especialistas_revision); aquí no hay especialistas escritos. Se guarda por el webhook guardar-especialista.
(function () {
  var LISTA = window.__ESPECIALISTAS__ || [];
  var URL_GUARDAR = 'https://inteligencia-xternum.app.n8n.cloud/webhook/guardar-especialista';
  var cont = document.getElementById('listaEsp');
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  function quien() { var v = $('validadoPor'); return v ? v.value.trim() : ''; }
  try { var g = localStorage.getItem('talox_revisor'); if (g && $('validadoPor')) $('validadoPor').value = g; } catch (e) {}
  if ($('validadoPor')) $('validadoPor').addEventListener('change', function () { try { localStorage.setItem('talox_revisor', quien()); } catch (e) {} });

  function fecha(s) { try { return new Date(s).toLocaleDateString('es-UY'); } catch (e) { return ''; } }

  function tarjeta(e, i) {
    var ok = e.estado === 'validada';
    var h = '<div class="campo-card' + (ok ? ' validado' : '') + '" data-i="' + i + '"><div class="campo-cab"><div><span class="etq">' + esc(e.nombre) + '</span> ';
    h += ok ? '<span class="chip-ok">✓ Validada por ' + esc(e.validada_por || '') + (e.validada_el ? ' · ' + esc(fecha(e.validada_el)) : '') + '</span>' : '<span class="chip-pend">Sin validar</span>';
    h += '</div></div><div class="campo-cuerpo">';
    h += '<div class="cmp"><label class="t">Qué hace (en palabras del consultor)</label><textarea data-k="para_que_sirve" rows="3">' + esc(e.para_que_sirve) + '</textarea></div>';
    h += '<div class="cmp" style="margin-top:10px;"><label class="t">Aplica a (qué tipo de entregables)</label><textarea data-k="aplica_a" rows="2">' + esc(e.aplica_a) + '</textarea></div>';
    h += '<div class="cmp" style="margin-top:10px;"><label class="t">No aplica a (qué entregables NO debe producir)</label><textarea data-k="no_aplica_a" rows="2">' + esc(e.no_aplica_a) + '</textarea></div>';
    if (e.detalle_tecnico) h += '<details style="margin-top:10px;"><summary class="hint">Detalle técnico del flujo (para entender qué hace por dentro)</summary><div class="hint" style="margin-top:6px;">' + esc(e.detalle_tecnico) + '</div></details>';
    h += '<div class="fila-acciones" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;"><button type="button" class="boton" data-a="validar">✓ Validar descripción</button><button type="button" class="boton-guardar" data-a="borrador">Guardar sin validar</button><span class="hint" data-r></span></div>';
    h += '</div></div>';
    return h;
  }

  function render() {
    if (!LISTA.length) { cont.innerHTML = '<div class="aviso-caja"><div>No hay especialistas activos registrados.</div></div>'; return; }
    cont.innerHTML = LISTA.map(tarjeta).join('');
    resumen();
  }

  function resumen() {
    var p = LISTA.filter(function (e) { return e.estado !== 'validada'; }).length;
    $('resumenEsp').textContent = p ? p + ' de ' + LISTA.length + ' especialistas sin validar.' : 'Todas las descripciones están validadas.';
  }

  cont.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-a]'); if (!b) return;
    var card = b.closest('.campo-card'); var e = LISTA[+card.getAttribute('data-i')];
    var r = card.querySelector('[data-r]'); r.className = 'hint'; r.textContent = 'Guardando...';
    var cuerpo = { workflow_id: e.workflow_id, validar: b.getAttribute('data-a') === 'validar', por: quien() };
    card.querySelectorAll('textarea[data-k]').forEach(function (t) { cuerpo[t.getAttribute('data-k')] = t.value; });
    fetch(URL_GUARDAR, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { if (!res.ok || j.ok === false) throw new Error((j.motivos && j.motivos.join('; ')) || j.mensaje || 'Error del servidor'); return j; }); })
      .then(function (j) {
        e.para_que_sirve = cuerpo.para_que_sirve; e.aplica_a = cuerpo.aplica_a; e.no_aplica_a = cuerpo.no_aplica_a;
        e.estado = j.estado; e.validada_por = j.estado === 'validada' ? quien() : null; e.validada_el = j.estado === 'validada' ? new Date().toISOString() : null;
        var pos = card.getAttribute('data-i'); card.outerHTML = tarjeta(e, pos); resumen();
        var n = cont.querySelector('.campo-card[data-i="' + pos + '"] [data-r]'); if (n) n.textContent = j.estado === 'validada' ? 'Validada y guardada.' : 'Guardado como borrador.';
      })
      .catch(function (err) { r.className = 'hint malo-txt'; r.textContent = 'No se pudo guardar: ' + err.message; });
  });
  render();
})();
