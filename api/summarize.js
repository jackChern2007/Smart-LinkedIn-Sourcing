const { buildPrompt } = require("./prompts");

const MODEL = "claude-sonnet-4-6";

module.exports = async (req, res) => {
  // Allow the GitHub Pages frontend (or any origin) to call this endpoint.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const notes = (req.body && req.body.notes) || "";
  if (!notes.trim()) {
    res.status(400).json({ error: "No meeting notes provided." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is not configured with an Anthropic API key." });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: buildPrompt(notes) }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      res.status(response.status).json({ error: `Anthropic API error: ${errBody}` });
      return;
    }

    const data = await response.json();
    res.status(200).json({ result: data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
