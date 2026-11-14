
const MODEL = "gemini-3.5-flash-lite";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://christoph1807.github.io",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return respond({ error: "Nur POST ist erlaubt." }, 405);
    }

    async function askGemini(contents, systemText) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemText }]
            },
            contents,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1200
            }
          }),
          signal: AbortSignal.timeout(25000)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Google API Fehler");
      }

      return data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "";
    }

    try {
      const body = await request.json();

      const messages = Array.isArray(body.messages)
        ? body.messages
        : [{ role: "user", content: body.message || "" }];

      const memory = Array.isArray(body.memory)
        ? body.memory.filter(x => typeof x === "string").slice(-30)
        : [];

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
        return respond({ error: "Keine Nachricht erhalten." }, 400);
      }

      const memoryText = memory.length
        ? "\nBisher bekannte Informationen über den Nutzer:\n- " + memory.join("\n- ")
        : "\nBisher sind keine dauerhaften Informationen bekannt.";

      const reply = await askGemini(
        contents,
        "Du bist JARVIS, ein persönlicher KI-Assistent. Antworte auf Deutsch, freundlich, respektvoll und verständlich. Berücksichtige den Gesprächsverlauf und die folgenden dauerhaften Erinnerungen. Behaupte niemals, etwas zu wissen, das nicht im Kontext steht.\n" + memoryText
      );

      let updatedMemory = memory;

      try {
        const latestConversation = messages.slice(-10)
          .map(m => `${m.role}: ${m.content}`)
          .join("\n");

        const extraction = await askGemini(
          [{
            role: "user",
            parts: [{
              text:
                "Bisherige Erinnerungen:\n" +
                JSON.stringify(memory) +
                "\n\nNeuer Gesprächsverlauf:\n" +
                latestConversation +
                "\n\nErstelle eine aktualisierte JSON-Liste mit höchstens 30 kurzen, wichtigen und langfristig nützlichen Fakten über den Nutzer. Übernimm nur Informationen, die der Nutzer selbst mitgeteilt hat. Bewahre weiterhin gültige Erinnerungen. Entferne veraltete oder widersprüchliche Fakten. Speichere keine Passwörter, API-Schlüssel, Bankdaten, Gesundheitsdaten oder andere besonders sensible Informationen. Erfinde nichts. Antworte ausschließlich mit einem JSON-Array aus Texten."
            }]
          }],
          "Du bist ein sorgfältiger Assistent für das Verwalten von Erinnerungen. Gib ausschließlich gültiges JSON zurück."
        );

        const parsed = JSON.parse(
          extraction.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
        );

        if (Array.isArray(parsed)) {
          updatedMemory = parsed
            .filter(x => typeof x === "string")
            .slice(-30);
        }} catch (memoryError) {
  updatedMemory = oldMemory;
  console.error("Gedächtnis-Fehler:", memoryError.message);
}

      return respond({
        reply,
        memory: updatedMemory
      });

    } catch (error) {
      return respond({
        error: error.message || "Interner Fehler"
      }, 502);
    }
  }
};
