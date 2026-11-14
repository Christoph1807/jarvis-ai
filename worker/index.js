
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://christoph1807.github.io",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const jsonResponse = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    if (request.method !== "POST") {
      return jsonResponse({ error: "Nur POST ist erlaubt." }, 405);
    }

    try {
      const body = await request.json();

      // Unterstützt den bisherigen Nachrichten-Aufruf
      // und den neuen Gesprächsverlauf.
      const messages = Array.isArray(body.messages)
        ? body.messages
        : [{ role: "user", content: body.message || "" }];

      const contents = messages
        .filter(m =>
          ["user", "model"].includes(m.role) &&
          typeof m.content === "string" &&
          m.content.trim()
        )
        .slice(-20)
        .map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));

      if (!contents.length) {
        return jsonResponse({ error: "Keine Nachricht erhalten." }, 400);
      }

      const apiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

      let lastError = "Unbekannter Fehler";

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{
                  text: "Du bist JARVIS, ein hilfreicher persönlicher KI-Assistent. Antworte auf Deutsch, freundlich, klar und verständlich. Berücksichtige den bisherigen Gesprächsverlauf."
                }]
              },
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024
              }
            }),
            signal: AbortSignal.timeout(18000)
          });

          const data = await response.json();

          if (!response.ok) {
            lastError = data.error?.message || "Google API Fehler";
            if (attempt < 2) {
              await new Promise(resolve =>
                setTimeout(resolve, 1500 * (attempt + 1))
              );
              continue;
            }
            return jsonResponse({ error: lastError }, 502);
          }

          const reply =
            data.candidates?.[0]?.content?.parts
              ?.map(part => part.text || "")
              .join("") || "Ich konnte leider keine Antwort erstellen.";

          return jsonResponse({ reply });
        } catch (error) {
          lastError = error.message || "Verbindungsfehler";
          if (attempt < 2) {
            await new Promise(resolve =>
              setTimeout(resolve, 1500 * (attempt + 1))
            );
          }
        }
      }

      return jsonResponse({ error: lastError }, 502);
    } catch (error) {
      return jsonResponse({
        error: error.message || "Interner Fehler"
      }, 500);
    }
  }
};
