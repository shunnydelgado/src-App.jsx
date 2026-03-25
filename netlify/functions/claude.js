exports.handler = async function(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" },
        body: "",
      };
    }

    const body = JSON.parse(event.body);
    const geminiKey = process.env.GEMINI_API_KEY;
    const visionKey = process.env.GOOGLE_VISION_KEY;

    // ── PASSPORT SCAN: use Google Cloud Vision OCR ──────────────────────────
    if (body.mode === "passport_scan") {
      const imageBase64 = body.image;
      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              image: { content: imageBase64 },
              features: [
                { type: "TEXT_DETECTION", maxResults: 1 },
                { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }
              ]
            }]
          })
        }
      );
      const visionData = await visionRes.json();
      console.log("Vision response:", JSON.stringify(visionData).slice(0, 500));

      const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text || 
                       visionData.responses?.[0]?.textAnnotations?.[0]?.description || "";

      if (!fullText) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: '{"error":"No se pudo leer el texto del documento"}' }] }),
        };
      }

      // Use Gemini to parse the extracted text into structured data
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: "You are a passport data extractor. Respond ONLY with valid JSON, no markdown, no extra text." }] },
            contents: [{
              role: "user",
              parts: [{ text: `Extract passport data from this OCR text and return ONLY this JSON:
{
  "name": "full name in uppercase",
  "nationality": "nationality in Spanish",
  "birthdate": "YYYY-MM-DD",
  "passport": "passport number",
  "expiry": "YYYY-MM-DD",
  "gender": "M or F",
  "birth_place": "country of birth"
}
If a field is not found, use "".

OCR TEXT:
${fullText}` }]
            }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
          })
        }
      );
      const parseData = await parseRes.json();
      const parsed = parseData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: parsed }] }),
      };
    }

    // ── REGULAR AI CHAT: use Gemini ─────────────────────────────────────────
    const messages = body.messages || [];
    const contents = messages.map(m => {
      if (typeof m.content === "string") {
        return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
      }
      const parts = m.content.map(part => {
        if (part.type === "text") return { text: part.text };
        if (part.type === "image") {
          let data = part.source?.data || part.data || "";
          if (data.includes(",")) data = data.split(",")[1];
          return { inlineData: { mimeType: "image/jpeg", data } };
        }
        return { text: JSON.stringify(part) };
      });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });

    const requestBody = {
      contents,
      generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
    };
    if (body.system) {
      requestBody.system_instruction = { parts: [{ text: body.system }] };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
    );
    const data = await response.json();
    console.log("Gemini response:", JSON.stringify(data).slice(0, 300));

    if (data.error) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: `Error: ${data.error.message}` }] }),
      };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo obtener respuesta.";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ content: [{ text }] }),
    };

  } catch(err) {
    console.log("Error:", err.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ content: [{ text: "Error: " + err.message }] }),
    };
  }
};
