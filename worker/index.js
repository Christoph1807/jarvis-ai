
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

      if (!message || typeof message !== "string") {
        throw new Error("Bitte gib eine Nachricht ein.");
      }

      let lastError = "Gemini ist momentan nicht erreichbar.";

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": env.GEMINI_API_KEY
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{
                    text: "Du bist JARVIS, ein intelligenter persönlicher KI-Assistent. Antworte immer auf Deutsch, freundlich, klar und hilfreich."
                  }]
                },
                contents: [{
                  role: "user",
                  parts: [{ text: message }]
                }],
                generationConfig: {
                  maxOutputTokens: 1024
                }
              }),
              signal: AbortSignal.timeout(18000)
            }
          );

          const raw = await response.text();
          let data;

          try {
            data = JSON.parse(raw);
          } catch {
            throw new Error("Google hat eine ungültige Antwort gesendet.");
          }

          if (!response.ok) {
            lastError = data.error?.message || "Gemini Fehler " + response.status;

            if (![408, 429, 500, 502, 503, 504].includes(response.status)) {
              throw new Error(lastError);
            }

            throw new Error(lastError);
          }

          const reply = data.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("");

          if (!reply) {
            throw new Error("Gemini hat keine Antwort geliefert.");
          }

          return new Response(
            JSON.stringify({ reply }),
            { headers }
          );

        } catch (error) {
          lastError = error.name === "TimeoutError"
            ? "Gemini hat zu lange gebraucht."
            : error.message;

          if (attempt < 2) {
            await new Promise(resolve =>
              setTimeout(resolve, 1500 * Math.pow(2, attempt))
            );
          }
        }
      }

      return new Response(
        JSON.stringify({
          error: "JARVIS: " + lastError +
            " Bitte versuche es in einer Minute erneut."
        }),
        { status: 503, headers }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers }
      );
    }
  }
};
