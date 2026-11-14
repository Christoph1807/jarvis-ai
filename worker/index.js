
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "https://christoph1807.github.io",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST erforderlich" }), {
        status: 405, headers: cors
      });
    }

    try {
      const { message } = await request.json();

      if (!env.GEMINI_API_KEY) {
        throw new Error("Gemini API-Key fehlt.");
      }

      const result = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: "Du bist JARVIS, ein intelligenter persönlicher Assistent. Antworte auf Deutsch, freundlich und präzise."
              }]
            },
            contents: [{
              role: "user",
              parts: [{ text: message }]
            }]
          })
        }
      );

      const data = await result.json();

      if (!result.ok) {
        throw new Error(data.error?.message || "Gemini-Fehler");
      }

      const reply = data.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "").join("") || "Keine Antwort erhalten.";

      return new Response(JSON.stringify({ reply }), {
        headers: cors
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: cors
      });
    }
  }
};
