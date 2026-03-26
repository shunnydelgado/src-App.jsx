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
    const body = JSON.parse(event.body || "{}");

    // ── PASSPORT SCAN ────────────────────────────────────────────────────────
    if (body.mode === "passport_scan") {
      let imageBase64 = body.image || "";
      const isPDF = body.isPDF || false;

      if (imageBase64.includes(",")) imageBase64 = imageBase64.split(",")[1];
      imageBase64 = imageBase64.replace(/\s/g, "");
      const sizeKB = Math.round(imageBase64.length * 0.75 / 1024);
      console.log("isPDF:", isPDF, "| Size KB:", sizeKB);

      const mimeType = isPDF ? "application/pdf" : "image/jpeg";

      // ── Try Document AI first ──────────────────────────────────────────────
      console.log("Trying Document AI...");
      const docAIUrl = "https://us-documentai.googleapis.com/v1/projects/177073675450/locations/us/processors/6a3484bf5abb74c6:process";

      const docAIRes = await fetch(`${docAIUrl}?key=${visionKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawDocument: {
            content: imageBase64,
            mimeType: mimeType
          }
        })
      });

      const docAIData = await docAIRes.json();
      console.log("DocAI status:", docAIRes.status);
      console.log("DocAI response:", JSON.stringify(docAIData).slice(0, 800));

      let extractedText = "";

      if (!docAIData.error && docAIData.document) {
        // Extract text from Document AI response
        extractedText = docAIData.document.text || "";

        // Also try to get structured entities if available
        const entities = docAIData.document.entities || [];
        if (entities.length > 0) {
          console.log("Entities found:", entities.length);
          // Build structured data directly from entities
          const get = (type) => entities.find(e => e.type === type)?.mentionText || "";
          const parsed = {
            name: (get("family-name") + " " + get("given-names")).trim() || get("name") || "",
            nationality: get("nationality") || "",
            birthdate: get("date-of-birth") || "",
            passport: get("document-number") || "",
            expiry: get("expiration-date") || "",
            gender: get("gender") || "",
            birth_place: get("place-of-birth") || "",
          };
          // If we got good data from entities, return directly
          if (parsed.name || parsed.passport) {
            console.log("Direct entities result:", JSON.stringify(parsed));
            return {
              statusCode: 200,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify({ content: [{ text: JSON.stringify(parsed) }] }),
            };
          }
        }
        console.log("DocAI text length:", extractedText.length);
      } else {
        console.log("DocAI failed, error:", docAIData.error?.message);
        // Fallback: use Google Vision for images
        if (!isPDF) {
          console.log("Falling back to Google Vision...");
          const visionRes = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requests: [{
                  image: { content: imageBase64 },
                  features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
                  imageContext: { languageHints: ["es", "en"] }
                }]
              })
            }
          );
          const visionData = await visionRes.json();
          console.log("Vision fallback:", JSON.stringify(visionData).slice(0, 300));
          extractedText = visionData.responses?.[0]?.fullTextAnnotation?.text ||
                          visionData.responses?.[0]?.textAnnotations?.[0]?.description || "";
        }
      }

      if (!extractedText || extractedText.length < 5) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ content: [{ text: '{"error":"No se pudo leer el documento"}' }] }),
        };
      }

      // Parse extracted text with Gemini
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: "Extract passport data. Return ONLY valid JSON, no markdown, no explanation." }] },
            contents: [{
              role: "user",
              parts: [{ text: `From this passport text return ONLY this JSON:
{"name":"APELLIDOS NOMBRES uppercase","nationality":"in Spanish","birthdate":"YYYY-MM-DD","passport":"number","expiry":"YYYY-MM-DD","gender":"M or F","birth_place":"country"}
Use "" for missing. Dates always YYYY-MM-DD. Months: JAN=01 FEB=02 MAR=03 APR=04 MAY=05 JUN=06 JUL=07 AUG=08 SEP=09 OCT=10 NOV=11 DEC=12

TEXT:
${extractedText}` }]
            }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.1 }
          })
        }
      );
      const parseData = await parseRes.json();
      const result = parseData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      console.log("Final parsed result:", result);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ text: result }] }),
      };
    }

    // ── REGULAR AI CHAT ──────────────────────────────────────────────────────
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
    if (data.error) return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ content: [{ text: `Error: ${data.error.message}` }] })
    };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo obtener respuesta.";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ content: [{ text }] })
    };

  } catch(err) {
    console.log("Error:", err.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ content: [{ text: "Error: " + err.message }] })
    };
  }
};
