
export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "https://christoph1807.github.io",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ message: "JARVIS ist bereit." }),
        { headers }
      );
    }

    try {
      const { message } = await request.json();

      if (!message) {
        throw new Error("Keine Nachricht erhalten.");
      }

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: "Du bist JARVIS, ein intelligenter persönlicher Assistent. Antworte immer auf Deutsch, freundlich, klar und hilfreich."
              }]
            },
            contents: [{
              role: "user",
              parts: [{ text: message }]
            }]
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message || "Fehler bei Gemini."
        );
      }

      const reply = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("");

      return new Response(
        JSON.stringify({ reply: reply || "Keine Antwort erhalten." }),
        { headers }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers }
      );
    }
  }
};
