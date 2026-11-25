// Pantallas HITL 1 y HITL 2 (generadas por los flujos 02 y 03 de n8n): sustituye los cuadros del navegador por los avisos propios de TaloX.
// No reescribe la lógica de las pantallas: muestra el aviso o la pregunta con dialogos.js y, una vez respondida, llama a la función original
// de la página con la respuesta ya resuelta. Requiere cargar antes dialogos.js. Si algo no está, la página sigue con sus cuadros nativos.
(function () {
  var D = window.TaloXDialogo;
  if (!D) return;

  // Los avisos (alert) no devuelven nada, así que se pueden reemplazar directamente
  window.alert = function (texto) { D.aviso(String(texto == null ? '' : texto)); };

  // Ejecuta la función original de la página con un confirm/prompt ya respondido
  function conRespuesta(nombre, valor, fn) {
    var orig = window[nombre];
    window[nombre] = function () { return valor; };
    try { fn(); } finally { window[nombre] = orig; }
  }

  var originales = {
    enviarAprobacion: window.enviarAprobacion,
    cancelarEncargo: window.cancelarEncargo
  };

  // Aprobar con HITL 1: si no hay ningún archivo seleccionado, la página pregunta si continuar sin insumos del cliente
  if (typeof originales.enviarAprobacion === 'function') {
    window.enviarAprobacion = function () {
      var sels = document.querySelectorAll('.selector-rol-archivo');
      var alguno = Array.prototype.some.call(sels, function (s) { return s.value !== 'omitir'; });
      if (sels.length > 0 && !alguno) {
        D.confirmar('No has seleccionado ningún archivo de Google Drive.\n¿Deseas continuar sin insumos del cliente (investigación y redacción autónoma)?', { si: 'Continuar sin insumos', no: 'Volver' }).then(function (ok) {
          if (ok) conRespuesta('confirm', true, originales.enviarAprobacion);
        });
        return;
      }
      originales.enviarAprobacion();
    };
  }

  // Cancelar: la página pide el motivo; vacío es válido (la página pone un motivo por defecto), cancelar el cuadro no envía nada
  if (typeof originales.cancelarEncargo === 'function') {
    window.cancelarEncargo = function () {
      var etiqueta = document.querySelector('.boton-rechazo');
      var texto = etiqueta && /publicaci/i.test(etiqueta.textContent) ? 'Indica el motivo por el que frenas la publicación (opcional).' : 'Describe brevemente el motivo de cancelación de esta solicitud (opcional).';
      D.pedirTexto(texto, { etiqueta: 'Motivo', si: 'Confirmar', no: 'Volver' }).then(function (m) {
        if (m === null) return;
        conRespuesta('prompt', m, originales.cancelarEncargo);
      });
    };
  }
})();
