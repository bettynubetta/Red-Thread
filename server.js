const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const APP_ORIGIN = process.env.APP_ORIGIN;

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!APP_ORIGIN || origin === APP_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "red-thread-ai" });
});

app.post("/api/think", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: "The AI service is not configured yet." });
    }

    const { thoughts, prompt } = req.body || {};
    if (!Array.isArray(thoughts) || thoughts.length === 0) {
      return res.status(400).json({ error: "Add at least one thought first." });
    }

    const cleanedThoughts = thoughts.slice(0, 40)
      .map((item) => String(item).trim().slice(0, 2000))
      .filter(Boolean);

    if (!cleanedThoughts.length) {
      return res.status(400).json({ error: "No usable thoughts were provided." });
    }

    const userPrompt = String(prompt || "Look for meaningful connections between these thoughts.")
      .trim().slice(0, 1000);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: [
          "You are the thinking partner inside Red Thread.",
          "Help the user explore what they think, not just what they know.",
          "Do not act like a generic therapist or take over the user's thinking.",
          "Identify possible relationships among the supplied thoughts, including uncertain or surprising connections.",
          "Do not claim a connection is certain when it is only a possibility.",
          "Preserve the user's meaning; do not rewrite their thoughts as if you know what they intended.",
          "Be concise, curious, plain-spoken, and nonjudgmental.",
          "Return practical suggestions and questions, not a long essay."
        ].join(" "),
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: `User request: ${userPrompt}` },
            { type: "input_text", text: `Thoughts:\n${cleanedThoughts.map((t, i) => `${i + 1}. ${t}`).join("\n")}` },
            { type: "input_text", text: "Offer up to 3 possible connections, briefly explain each, and finish with one useful question. If no clear connection exists, say so." }
          ]
        }],
        max_output_tokens: 700
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(502).json({ error: "The AI service could not complete that request." });
    }

    const answer = (data.output || [])
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("\n").trim();

    return res.json({ answer: answer || "I couldn't find a useful response in that attempt." });
  } catch (error) {
    console.error("Request failed:", error);
    return res.status(500).json({ error: "Something went wrong while processing the thoughts." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Red Thread AI backend listening on port ${PORT}`);
});
