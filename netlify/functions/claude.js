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
    const apiKey = process.env.GEMINI_API_KEY;
    const messages = body.messages || [];

    const contents = messages.map(m => {
      if (typeof m.content === "string") {
        return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
      }
      // Handle array content (documents, images)
      const parts = m.content.map(part => {
        if (part.type === "text") return { text: part.text };
        if (part.type === "image") return { inlineData: { mimeType: part.source.media_type, data: part.source.data } };
        if (part.type === "document") return { inlineData: { mimeType: "application/pdf", data: part.source.data } };
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
    );

    const data = await response.json();
    console.log("Gemini response:", JSON.stringify(data).slice(0, 300));
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
