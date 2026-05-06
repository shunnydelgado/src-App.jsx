const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ── KNOWLEDGE BASE — Requisitos migratorios Curaçao ──────────────────────────
const MIGRATION_REQUIREMENTS = {
  "riba_e_luga": {
    nombre: "Programa Riba e Luga",
    descripcion: "Programa de regularización migratoria para extranjeros en Curaçao",
    documentos_requeridos: [
      "Pasaporte vigente (mínimo 6 meses de validez)",
      "Foto reciente tipo pasaporte (fondo blanco)",
      "Certificado de nacimiento apostillado",
      "Certificado de antecedentes penales apostillado (país de origen)",
      "Certificado médico (emitido por médico autorizado en Curaçao)",
      "Prueba de residencia en Curaçao (contrato de arrendamiento o declaración)",
      "Comprobante de ingresos o empleo",
      "Formulario de solicitud Riba e Luga completado",
      "Comprobante de pago de tasas a Migración",
      "Declaración jurada de buena conducta",
    ],
    notas: "El programa Riba e Luga es para personas que ya residen en Curaçao y buscan regularizar su estatus migratorio.",
    tiempo_proceso: "3-6 meses aproximadamente",
    costo_aproximado: "Varía según el caso",
  },
  "permiso_trabajo": {
    nombre: "Permiso de Trabajo (Arbeidsvergunning)",
    descripcion: "Permiso para trabajar legalmente en Curaçao",
    documentos_requeridos: [
      "Pasaporte vigente (mínimo 6 meses de validez)",
      "Foto reciente tipo pasaporte",
      "Contrato de trabajo firmado por empleador",
      "Carta del empleador con justificación de contratación",
      "Certificado médico",
      "Antecedentes penales apostillado",
      "Formulario de solicitud de permiso de trabajo",
      "Comprobante de pago a Migración",
      "CV / Hoja de vida actualizada",
      "Diplomas o certificados de educación apostillados",
    ],
    notas: "El empleador debe demostrar que no hay ciudadanos de Curaçao disponibles para el puesto.",
    tiempo_proceso: "2-4 meses",
    costo_aproximado: "ANG 150-300 según categoría",
  },
  "permiso_residencia": {
    nombre: "Permiso de Residencia (Verblijfsvergunning)",
    descripcion: "Permiso para residir legalmente en Curaçao",
    documentos_requeridos: [
      "Pasaporte vigente (mínimo 6 meses de validez)",
      "Foto reciente tipo pasaporte",
      "Certificado de nacimiento apostillado",
      "Certificado de matrimonio apostillado (si aplica)",
      "Antecedentes penales apostillado",
      "Certificado médico",
      "Comprobante de ingresos suficientes",
      "Seguro médico válido en Curaçao",
      "Prueba de alojamiento",
      "Formulario de solicitud",
      "Comprobante de pago a Migración",
    ],
    tiempo_proceso: "3-5 meses",
    costo_aproximado: "ANG 200-400",
  },
  "reunificacion_familiar": {
    nombre: "Reunificación Familiar",
    descripcion: "Permiso para reunirse con familiar residente legal en Curaçao",
    documentos_requeridos: [
      "Pasaporte vigente del solicitante",
      "Pasaporte del familiar residente en Curaçao",
      "Prueba de relación familiar (acta de matrimonio, nacimiento apostillada)",
      "Permiso de residencia vigente del familiar en Curaçao",
      "Comprobante de ingresos del familiar en Curaçao",
      "Certificado médico del solicitante",
      "Antecedentes penales apostillado",
      "Fotos tipo pasaporte",
      "Formulario de solicitud",
      "Comprobante de pago a Migración",
    ],
    tiempo_proceso: "3-6 meses",
  },
};

async function callOpenAI(messages, maxTokens=1500, jsonMode=false) {
  const body = {
    model: "gpt-4o",
    max_tokens: maxTokens,
    messages,
  };
  if(jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

exports.handler = async function(event) {
  if(event.httpMethod === "OPTIONS") {
    return { statusCode:200, headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type"}, body:"" };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    // ── PASSPORT SCAN ────────────────────────────────────────────────────────
    if(body.mode === "passport_scan") {
      let imageBase64 = body.image || "";
      if(imageBase64.includes(",")) imageBase64 = imageBase64.split(",")[1];
      imageBase64 = imageBase64.replace(/\s/g, "");

      console.log("GPT-4o passport scan, size KB:", Math.round(imageBase64.length * 0.75 / 1024));

      const messages = [
        {
          role: "system",
          content: `Eres un asistente especializado en extraer datos de pasaportes y documentos de identidad. 
          Extrae SOLO los datos visibles y devuelve ÚNICAMENTE un JSON válido sin markdown, sin explicaciones.
          Si un campo no está visible, usa cadena vacía "".
          Formato de fechas siempre YYYY-MM-DD.
          Meses en inglés: JAN=01 FEB=02 MAR=03 APR=04 MAY=05 JUN=06 JUL=07 AUG=08 SEP=09 OCT=10 NOV=11 DEC=12`
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            },
            {
              type: "text",
              text: `Extrae los datos de este pasaporte y devuelve SOLO este JSON:
{
  "name": "APELLIDOS NOMBRES en mayúsculas",
  "nationality": "nacionalidad en español",
  "birthdate": "YYYY-MM-DD",
  "passport": "número de pasaporte",
  "expiry": "YYYY-MM-DD fecha de vencimiento",
  "gender": "M o F",
  "birth_place": "lugar de nacimiento"
}`
            }
          ]
        }
      ];

      const result = await callOpenAI(messages, 300, false);
      console.log("GPT-4o passport result:", result);
      
      // Clean and parse
      const cleaned = result.replace(/```json|```/g, "").trim();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: cleaned }] }),
      };
    }

    // ── MIGRATION AGENT ──────────────────────────────────────────────────────
    if(body.mode === "migration_check") {
      const client = body.client || {};
      const programa = body.programa || "permiso_trabajo";
      const reqs = MIGRATION_REQUIREMENTS[programa];

      if(!reqs) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: JSON.stringify({ error: "Programa no encontrado" }) }] }),
        };
      }

      const docsEntregados = client.documents || [];
      const docsSubidos = (client.uploaded_docs || []).map(d => d.name || d).join(", ") || "Ninguno";

      const messages = [
        {
          role: "system",
          content: `Eres un experto en leyes migratorias de Curaçao, específicamente en el ${reqs.nombre}.
          
Tu trabajo es revisar el expediente de un cliente y determinar:
1. Qué documentos tiene completos
2. Qué documentos faltan
3. Qué acciones debe tomar
4. Un análisis general del caso

Responde SIEMPRE en español y de forma clara y profesional.
Devuelve SOLO un JSON válido sin markdown.`
        },
        {
          role: "user",
          content: `Analiza este expediente para el programa ${reqs.nombre}:

CLIENTE: ${client.name || "Sin nombre"}
TIPO DE TRÁMITE: ${client.type || "No especificado"}
ESTATUS ACTUAL: ${client.status || "Sin estatus"}
NACIONALIDAD: ${client.nationality || "No especificada"}

DOCUMENTOS REGISTRADOS EN SISTEMA:
${docsEntregados.length > 0 ? docsEntregados.join("\n") : "Ninguno registrado"}

ARCHIVOS SUBIDOS AL EXPEDIENTE:
${docsSubidos}

DESCRIPCIÓN DEL CASO:
${client.caso_descripcion || "Sin descripción"}

REQUISITOS DEL PROGRAMA ${reqs.nombre.toUpperCase()}:
${reqs.documentos_requeridos.join("\n")}

Notas del programa: ${reqs.notas || ""}

Devuelve este JSON:
{
  "programa": "${reqs.nombre}",
  "cliente": "${client.name || ""}",
  "porcentaje_completado": número del 0 al 100,
  "documentos_completos": ["lista de docs que SÍ tiene"],
  "documentos_faltantes": ["lista de docs que le FALTAN"],
  "acciones_urgentes": ["acciones que debe tomar YA"],
  "recomendaciones": ["sugerencias generales"],
  "tiempo_estimado": "tiempo estimado para completar expediente",
  "resumen": "párrafo de 2-3 oraciones con el análisis general del caso",
  "listo_para_presentar": true o false
}`
        }
      ];

      const result = await callOpenAI(messages, 1500, false);
      console.log("Migration check result:", result.slice(0, 200));
      const cleaned = result.replace(/```json|```/g, "").trim();

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: cleaned }] }),
      };
    }

    // ── GENERAL AI CHAT with GPT-4o ──────────────────────────────────────────
    if(body.mode === "chat") {
      const messages = [];
      if(body.system) messages.push({ role:"system", content:body.system });
      (body.messages||[]).forEach(m => messages.push({ role:m.role==="assistant"?"assistant":"user", content:m.content }));

      const result = await callOpenAI(messages, body.max_tokens||1500);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: result }] }),
      };
    }

    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Mode not specified" }),
    };

  } catch(err) {
    console.error("OpenAI function error:", err.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ content: [{ text: "Error: " + err.message }] }),
    };
  }
};
