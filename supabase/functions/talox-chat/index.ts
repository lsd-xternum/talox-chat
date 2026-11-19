import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const apiKey =
      req.headers.get("x-api-key") ||
      body.apiKey ||
      Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Falta ANTHROPIC_API_KEY en Supabase Secrets." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Conexión a Supabase (Service Role para leer metadatos del sistema)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const safeSelect = async (table: string, columns = "*") => {
      try {
        const res = await supabase.from(table).select(columns);
        return res.data || [];
      } catch (_) {
        return [];
      }
    };

    // 2. Catálogo liviano. Solo columnas necesarias: nunca workflow_json, contratos ni descripciones largas.
    //    Todo encargo se interpreta como un PRODUCTO; el producto trae sus plantillas (entregables) en orden.
    const [
      configData,
      mejorasData,
      flujosData,
      clientesData,
      productosData,
      vinculosData,
      plantillasData
    ] = await Promise.all([
      safeSelect("talox_config"),
      safeSelect("mejoras_talox", "titulo, categoria, prioridad, estado"),
      safeSelect("flujos_n8n_activos", "capacidad_codigo, nombre, lo_que_resuelve_solo"),
      safeSelect("clientes_carpetas", "cliente_nombre"),
      safeSelect("productos", "codigo, nombre, area_codigo, descripcion, activo"),
      safeSelect("producto_plantillas", "producto_codigo, plantilla_codigo, orden"),
      safeSelect("plantillas", "codigo, nombre, estado, activo, workflow_id, contrato_estado")
    ]);

    const plantillaPorCodigo = new Map(
      plantillasData.filter((p: any) => p.activo !== false).map((p: any) => [p.codigo, p])
    );
    const productosActivos = productosData.filter((p: any) => p.activo !== false);

    const lineaPlantilla = (p: any, n: number) => {
      const avisos: string[] = [];
      if (!p.workflow_id) avisos.push("sin especialista");
      if (!p.contrato_estado) avisos.push("sin contrato");
      return `    ${n}. "${p.codigo}" | ${p.nombre}${avisos.length ? ` (${avisos.join(", ")})` : ""}`;
    };

    const catalogoProductos = productosActivos.map((prod: any) => {
      const vinculos = vinculosData
        .filter((v: any) => v.producto_codigo === prod.codigo && plantillaPorCodigo.has(v.plantilla_codigo))
        .sort((a: any, b: any) => (a.orden ?? 999) - (b.orden ?? 999));
      const cabecera = `- PRODUCTO "${prod.codigo}" | ${prod.nombre} | área: ${prod.area_codigo || "sin área"}${prod.descripcion ? ` | ${String(prod.descripcion).slice(0, 160)}` : ""}`;
      const lineas = vinculos.length
        ? vinculos.map((v: any, i: number) => lineaPlantilla(plantillaPorCodigo.get(v.plantilla_codigo), i + 1)).join("\n")
        : "    (sin plantillas vinculadas todavía)";
      return `${cabecera}\n  Plantillas (entregables, en orden):\n${lineas}`;
    }).join("\n");

    // 3. Prompt base
    const promptRow = configData.find((r: any) => r.id === "system_prompt");
    const basePrompt = promptRow?.valor || body.system || "";

    const clientes = [...new Set(clientesData.map((c: any) => c.cliente_nombre).filter(Boolean))];
    const mejorasPendientes = mejorasData.filter((m: any) => m.estado === "pendiente" || m.estado === "aprobado");

    // 4. Inyección del contexto dinámico de Supabase
    const contextoSupabase = `
---
CONTEXTO DINÁMICO DE SUPABASE (Leído en tiempo real desde la base de datos):

CATÁLOGO DE PRODUCTOS Y SUS PLANTILLAS:
${catalogoProductos || "Sin productos"}

CLIENTES OFICIALES:
${clientes.map((n: string) => `- ${n}`).join("\n") || "Sin clientes"}

CAPACIDADES Y FLUJOS N8N (solo para encargos internos de XTERNUM):
${flujosData.map((f: any) => `- ${f.capacidad_codigo} (${f.nombre}): ${f.lo_que_resuelve_solo || ""}`).join("\n") || "Sin flujos"}

MEJORAS PENDIENTES DE TALOX (solo título y prioridad; el detalle lo tiene el Arquitecto Jefe):
${mejorasPendientes.map((m: any) => `- [${m.prioridad}] ${m.titulo} (${m.categoria})`).join("\n") || "Sin mejoras pendientes"}

CONFIGURACIÓN OPERATIVA DEL SISTEMA (talox_config):
${
  configData.length > 0
    ? configData
        .filter((c: any) => c.id !== "system_prompt")
        .map((c: any) => `- ${c.id}: ${c.valor} (${c.descripcion || c.tipo || ""})`)
        .join("\n")
    : "Sin variables de configuración."
}
---
`;

    const systemFinal = `${basePrompt}\n\n${contextoSupabase}`;

    // 5. Sanitizar mensajes para Anthropic
    let sanitizedMessages = (body.messages || []).filter(
      (m: any) => m.role === "user" || m.role === "assistant"
    );
    while (sanitizedMessages.length > 0 && sanitizedMessages[0].role === "assistant") {
      sanitizedMessages.shift();
    }

    if (sanitizedMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No hay mensajes de usuario válidos para procesar." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 6. Modelo: se resuelve desde el registro de roles (rol "conversacional"): modelo principal y respaldo.
    let modelCandidates: string[] = [];
    let registryMaxTokens = 0;
    let origenModelo = "registro";

    try {
      const { data: reg, error: regErr } = await supabase.rpc("resolver_modelos", {
        p_roles: ["conversacional"],
        p_especialista: null,
        p_tier: null
      });
      const conv = reg && (reg as any).conversacional;
      if (!regErr && conv && conv.modelo_id && conv.estado !== "retirado") {
        modelCandidates = [conv.modelo_id, conv.respaldo_modelo_id].filter(Boolean) as string[];
        registryMaxTokens = conv.max_tokens || 0;
      }
    } catch (_) {
      // si el registro no responde, se usa el descubrimiento de modelos como último recurso
    }

    // Último recurso: auto-descubrimiento en Anthropic (solo si el registro no resolvió ningún modelo)
    if (modelCandidates.length === 0) {
      origenModelo = "descubrimiento";
      try {
        const modelsRes = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
        });
        if (modelsRes.ok) {
          const modelsJson = await modelsRes.json();
          const availableIds: string[] = (modelsJson.data || []).map((m: any) => m.id);
          const haikuFound = availableIds.filter(id => id.includes("haiku"));
          const sonnetFound = availableIds.filter(id => id.includes("sonnet"));
          modelCandidates = [...haikuFound, ...sonnetFound, ...availableIds];
        }
      } catch (_) {}
    }

    const uniqueCandidates = [...new Set(modelCandidates)];
    const maxTokens = body.max_tokens || registryMaxTokens || 4096;
    let attemptLogs: string[] = [];

    for (const model of uniqueCandidates) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            max_tokens: maxTokens,
            system: systemFinal,
            messages: sanitizedMessages
          })
        });

        const data = await res.json();

        if (res.ok) {
          let rawText = "";
          if (Array.isArray(data.content)) {
            rawText = data.content
              .filter((b: any) => b.type === "text" && b.text)
              .map((b: any) => b.text)
              .join("\n")
              .trim();
          }
          if (!rawText && data.content?.[0]?.text) {
            rawText = data.content[0].text;
          }

          const visibleText = rawText.replace(/<!--TALOX_STATE[\s\S]*?TALOX_STATE-->/, "").trim();
          let finalText = rawText;
          if (!visibleText) {
            const fallback = "Hola. Recibido. ¿Qué encargo o análisis metodológico estructuramos hoy?";
            finalText = rawText ? `${fallback}\n\n${rawText}` : fallback;
          }

          return new Response(
            JSON.stringify({
              ...data,
              content: [{ type: "text", text: finalText }],
              text: finalText,
              reply: finalText,
              active_model: model,
              model_source: origenModelo
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
        }

        attemptLogs.push(`[${model}: ${data.error?.message || res.status}]`);

        // Errores de modelo inexistente, sobrecarga o límite: se prueba el modelo de respaldo.
        const tipo = data.error?.type;
        const reintentable = tipo === "not_found_error" || tipo === "overloaded_error" || tipo === "rate_limit_error" || tipo === "api_error" || res.status >= 500 || data.error?.message?.includes("model:");
        if (!reintentable) {
          return new Response(JSON.stringify({ error: data.error?.message || "Error en Anthropic", model_tested: model }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (err: any) {
        attemptLogs.push(`[${model}: ${err.message}]`);
      }
    }

    return new Response(
      JSON.stringify({
        error: `Ningún modelo respondió. Intentos: ${attemptLogs.join(" | ")}`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
