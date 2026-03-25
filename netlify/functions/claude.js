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

    // ── PASSPORT SCAN: Google Cloud Vision OCR ─────────────────────────────
    if (body.mode === "passport_scan") {
      let imageBase64 = body.image || "";

      // Strip data URL prefix if present
      if (imageBase64.includes(",")) {
        imageBase64 = imageBase64.split(",")[1];
      }

      // Remove any whitespace/newlines that corrupt base64
      imageBase64 = imageBase64.replace(/\s/g, "");

      const sizeKB = Math.round(imageBase64.length * 0.75 / 1024);
      console.log("Image base64 length:", imageBase64.length, "| Size ~KB:", sizeKB);

      if (!imageBase64 || imageBase64.length < 100) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: '{"error":"Imagen vacía o inválida"}' }] }),
        };
      }

      // If image too large (>4MB base64), return error
      if (sizeKB > 4096) {
        console.log("Image too large:", sizeKB, "KB — rejecting");
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: '{"error":"Imagen demasiado grande. Intenta con una imagen más pequeña."}' }] }),
        };
      }

      console.log("Calling Google Vision API...");
      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              image: { content: imageBase64 },
              features: [
                { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
                { type: "TEXT_DETECTION", maxResults: 1 }
              ]
            }]
          })
        }
      );

      const visionData = await visionRes.json();
      console.log("Vision response:", JSON.stringify(visionData).slice(0, 600));

      if (visionData.responses?.[0]?.error) {
        const errMsg = visionData.responses[0].error.message;
        console.log("Vision error:", errMsg);
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: `{"error":"Google Vision: ${errMsg}"}` }] }),
        };
      }

      const fullText =
        visionData.responses?.[0]?.fullTextAnnotation?.text ||
        visionData.responses?.[0]?.textAnnotations?.[0]?.description ||
        "";

      console.log("Extracted text length:", fullText.length);
      console.log("Text preview:", fullText.slice(0, 300));

      if (!fullText || fullText.length < 10) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: '{"error":"No se detectó texto en la imagen. Intenta con mejor iluminación."}' }] }),
        };
      }

      // Use Gemini to parse OCR text into structured passport data
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: "You are a passport data extractor. Respond ONLY with valid JSON. No markdown, no explanation, no extra text." }]
            },
            contents: [{
              role: "user",
              parts: [{ text: `Extract passport data from this OCR text. Return ONLY this exact JSON structure:
{
  "name": "FULL NAME IN UPPERCASE as it appears",
  "nationality": "nationality in Spanish (e.g. Venezolana, Colombiana, Dominicana)",
  "birthdate": "YYYY-MM-DD format",
  "passport": "passport number",
  "expiry": "YYYY-MM-DD expiry date of passport",
  "gender": "M or F",
  "birth_place": "country of birth in Spanish"
}

Rules:
- For dates: convert DD MMM YYYY or DDMMYYYY to YYYY-MM-DD
- Month abbreviations: JAN=01, FEB=02, MAR=03, APR=04, MAY=05, JUN=06, JUL=07, AUG=08, SEP=09, OCT=10, NOV=11, DEC=12
- If field not found, use empty string ""
- Name appears after "SURNAME" or "APELLIDOS" or in the MRZ line starting with P<

OCR TEXT:
${fullText}` }]
            }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
          })
        }
      );

      const parseData = await parseRes.json();
      const parsedText = parseData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      console.log("Gemini parsed:", parsedText);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: parsedText }] }),
      };
    }

    // ── REGULAR AI CHAT: Gemini ─────────────────────────────────────────────
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
