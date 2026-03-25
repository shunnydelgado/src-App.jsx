exports.handler = async function(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: "",
      };
    }

    const body = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    const systemText = body.system || "";
    const messages = body.messages || [];

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
    }));

    const requestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      }
    };

    if (systemText) {
      requestBody.system_instruction = {
        parts: [{ text: systemText }]
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    console.log("Gemini response:", JSON.stringify(data));

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text 
      || data?.candidates?.[0]?.output 
      || "Error obteniendo respuesta.";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
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
