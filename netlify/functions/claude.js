exports.handler = async function(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" },
        body: "",
      };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const visionKey = process.env.GOOGLE_VISION_KEY;

    // Check body size
    const bodyStr = event.body || "";
    const bodySizeKB = Math.round(bodyStr.length / 1024);
    console.log("Request body size KB:", bodySizeKB);

    const body = JSON.parse(bodyStr);

    // PASSPORT SCAN — image received as body, sent to Google Vision from server
    if (body.mode === "passport_scan") {
      let imageBase64 = body.image || "";
      if (imageBase64.includes(",")) imageBase64 = imageBase64.split(",")[1];
      imageBase64 = imageBase64.replace(/\s/g, "");
      console.log("Image size KB:", Math.round(imageBase64.length * 0.75 / 1024));

      // Call Google Vision from SERVER (no CORS issue)
      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              image: { content: imageBase64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }]
            }]
          })
        }
      );

      const visionData = await visionRes.json();
      console.log("Vision status:", visionRes.status);
      console.log("Vision response preview:", JSON.stringify(visionData).slice(0, 400));

      if (visionData.responses?.[0]?.error) {
        const errMsg = visionData.responses[0].error.message;
        console.log("Vision error:", errMsg);
        // Try with smaller image hint
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: `{"error":"Vision error: ${errMsg}"}` }] }),
        };
      }

      const fullText =
        visionData.responses?.[0]?.fullTextAnnotation?.text ||
        visionData.responses?.[0]?.textAnnotations?.[0]?.description || "";

      console.log("OCR text length:", fullText.length);
      console.log("OCR preview:", fullText.slice(0, 200));

      if (!fullText || fullText.length < 5) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: '{"error":"No text detected in image"}' }] }),
        };
      }

      // Parse OCR text with Gemini
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: "Extract passport data. Return ONLY valid JSON, no markdown." }] },
            contents: [{
              role: "user",
              parts: [{ text: `From this passport OCR text, return ONLY this JSON:
{"name":"FULL NAME","nationality":"in Spanish","birthdate":"YYYY-MM-DD","passport":"number","expiry":"YYYY-MM-DD","gender":"M or F","birth_place":"country"}
Use "" for missing. Convert dates to YYYY-MM-DD. Months: JAN=01 FEB=02 MAR=03 APR=04 MAY=05 JUN=06 JUL=07 AUG=08 SEP=09 OCT=10 NOV=11 DEC=12

OCR: ${fullText}` }]
            }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.1 }
          })
        }
      );

      const parseData = await parseRes.json();
      const result = parseData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      console.log("Parsed result:", result);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: result }] }),
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
    console.log("Error:", err.message, err.stack);
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ content: [{ text: "Error: " + err.message }] }) };
  }
};
