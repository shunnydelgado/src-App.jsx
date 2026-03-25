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

    // PARSE PASSPORT TEXT: receives OCR text from browser, returns structured JSON
    if (body.mode === "parse_passport_text") {
      const ocrText = body.text || "";
      console.log("Parsing OCR text, length:", ocrText.length);

      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: "You are a passport data extractor. Respond ONLY with valid JSON. No markdown, no explanation." }]
            },
            contents: [{
              role: "user",
              parts: [{ text: `Extract passport data from this OCR text. Return ONLY this JSON:
{"name":"FULL NAME","nationality":"in Spanish","birthdate":"YYYY-MM-DD","passport":"number","expiry":"YYYY-MM-DD","gender":"M or F","birth_place":"country in Spanish"}
Use empty string for missing. Convert dates: JAN=01,FEB=02,MAR=03,APR=04,MAY=05,JUN=06,JUL=07,AUG=08,SEP=09,OCT=10,NOV=11,DEC=12

OCR TEXT:
${ocrText}` }]
            }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.1 }
          })
        }
      );
      const parseData = await parseRes.json();
      const parsedText = parseData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      console.log("Parsed:", parsedText);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: parsedText }] }),
      };
    }

    // REGULAR AI CHAT
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

    const requestBody = { contents, generationConfig: { maxOutputTokens: 1500, temperature: 0.7 } };
    if (body.system) requestBody.system_instruction = { parts: [{ text: body.system }] };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
    );
    const data = await response.json();
    if (data.error) return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ content: [{ text: `Error: ${data.error.message}` }] }) };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo obtener respuesta.";
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ content: [{ text }] }) };

  } catch(err) {
    console.log("Error:", err.message);
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ content: [{ text: "Error: " + err.message }] }) };
  }
};
