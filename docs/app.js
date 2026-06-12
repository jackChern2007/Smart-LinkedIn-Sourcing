// Update this to the URL of your deployed Vercel function, e.g.
// "https://your-project.vercel.app/api/summarize"
const BACKEND_URL = "https://YOUR-VERCEL-PROJECT.vercel.app/api/summarize";

const fileInput = document.getElementById("file-input");
const notesInput = document.getElementById("notes-input");
const summarizeBtn = document.getElementById("summarize-btn");
const downloadBtn = document.getElementById("download-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const summaryOutput = document.getElementById("summary-output");
const actionsOutput = document.getElementById("actions-output");
const emailOutput = document.getElementById("email-output");

let lastResultText = "";

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    notesInput.value = reader.result;
  };
  reader.readAsText(file);
});

summarizeBtn.addEventListener("click", async () => {
  const notes = notesInput.value.trim();
  if (!notes) {
    statusEl.textContent = "Please paste some meeting notes or upload a file first.";
    return;
  }

  summarizeBtn.disabled = true;
  statusEl.textContent = "Summarizing... this can take a few seconds.";
  resultsEl.classList.add("hidden");

  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    lastResultText = data.result;
    renderResult(data.result);
    resultsEl.classList.remove("hidden");
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    summarizeBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([lastResultText], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `meeting_summary_${timestamp}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

function renderResult(text) {
  const sections = splitSections(text);
  summaryOutput.textContent = sections["Summary of Key Decisions"] || "(not found)";
  actionsOutput.textContent = sections["Action Items"] || "(not found)";
  emailOutput.textContent = sections["Draft Follow-Up Email"] || "(not found)";
}

// Splits the model's markdown response into sections keyed by their "## " heading.
function splitSections(text) {
  const sections = {};
  const parts = text.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const newlineIndex = part.indexOf("\n");
    const heading = part.slice(0, newlineIndex).trim();
    const body = part.slice(newlineIndex + 1).trim();
    sections[heading] = body;
  }
  return sections;
}
