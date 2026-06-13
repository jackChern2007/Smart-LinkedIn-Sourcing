// Update this to the URL of your deployed Vercel function, e.g.
// "https://your-project.vercel.app/api/summarize"
const BACKEND_URL = "https://smart-linked-in-sourcing.vercel.app/api/summarize";

// Update this to the OAuth Client ID from your Google Cloud project
// (APIs & Services > Credentials > OAuth 2.0 Client IDs > Web application).
const GOOGLE_CLIENT_ID = "45989514160-9crgvbir5gemp1ck9jisl0pf5fb7bh31.apps.googleusercontent.com";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/meetings.space.readonly";

const fileInput = document.getElementById("file-input");
const notesInput = document.getElementById("notes-input");
const summarizeBtn = document.getElementById("summarize-btn");
const downloadBtn = document.getElementById("download-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const summaryOutput = document.getElementById("summary-output");
const actionsOutput = document.getElementById("actions-output");
const emailOutput = document.getElementById("email-output");
const copyEmailBtn = document.getElementById("copy-email-btn");
const mailtoBtn = document.getElementById("mailto-btn");
const googleSigninBtn = document.getElementById("google-signin-btn");
const meetListContainer = document.getElementById("meet-list-container");
const meetSelect = document.getElementById("meet-select");
const loadTranscriptBtn = document.getElementById("load-transcript-btn");
const meetStatus = document.getElementById("meet-status");

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

copyEmailBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(emailOutput.textContent);
  copyEmailBtn.textContent = "Copied!";
  setTimeout(() => (copyEmailBtn.textContent = "Copy Email"), 1500);
});

mailtoBtn.addEventListener("click", () => {
  const subject = encodeURIComponent("Follow-up from our meeting");
  const body = encodeURIComponent(emailOutput.textContent);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
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

// --- Google Meet transcript import -----------------------------------------

let googleAccessToken = null;
let googleTokenClient = null;

window.addEventListener("load", () => {
  if (window.google && google.accounts && google.accounts.oauth2) {
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.error) {
          meetStatus.textContent = `Google sign-in error: ${response.error}`;
          return;
        }
        googleAccessToken = response.access_token;
        loadRecentMeetings();
      },
    });
  }
});

googleSigninBtn.addEventListener("click", () => {
  if (!googleTokenClient) {
    meetStatus.textContent = "Google sign-in is not configured yet.";
    return;
  }
  googleTokenClient.requestAccessToken();
});

async function loadRecentMeetings() {
  meetStatus.textContent = "Loading recent meetings...";
  meetListContainer.classList.add("hidden");

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const url = `https://meet.googleapis.com/v2/conferenceRecords?filter=${encodeURIComponent(
      `start_time>="${thirtyDaysAgo}"`
    )}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${googleAccessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to load meetings.");
    }

    const records = data.conferenceRecords || [];
    if (records.length === 0) {
      meetStatus.textContent = "No recent meetings found in the last 30 days.";
      return;
    }

    meetSelect.innerHTML = "";
    for (const record of records) {
      const option = document.createElement("option");
      option.value = record.name;
      option.textContent = record.startTime
        ? new Date(record.startTime).toLocaleString()
        : record.name;
      meetSelect.appendChild(option);
    }
    meetListContainer.classList.remove("hidden");
    meetStatus.textContent = "";
  } catch (err) {
    meetStatus.textContent = `Error: ${err.message}`;
  }
}

loadTranscriptBtn.addEventListener("click", async () => {
  const conferenceRecord = meetSelect.value;
  if (!conferenceRecord) return;

  meetStatus.textContent = "Loading transcript...";
  try {
    notesInput.value = await fetchTranscriptText(conferenceRecord);
    meetStatus.textContent = "Transcript loaded into the notes box below.";
  } catch (err) {
    meetStatus.textContent = `Error: ${err.message}`;
  }
});

async function fetchTranscriptText(conferenceRecord) {
  const transcriptsRes = await fetch(
    `https://meet.googleapis.com/v2/${conferenceRecord}/transcripts`,
    { headers: { Authorization: `Bearer ${googleAccessToken}` } }
  );
  const transcriptsData = await transcriptsRes.json();
  if (!transcriptsRes.ok) {
    throw new Error(transcriptsData.error?.message || "Failed to load transcript.");
  }

  const transcripts = transcriptsData.transcripts || [];
  if (transcripts.length === 0) {
    throw new Error("This meeting has no transcript available.");
  }
  const transcriptName = transcripts[0].name;

  // Transcript entries are paginated; fetch all pages and concatenate the text.
  let entries = [];
  let pageToken = "";
  do {
    const entriesUrl = new URL(`https://meet.googleapis.com/v2/${transcriptName}/entries`);
    if (pageToken) entriesUrl.searchParams.set("pageToken", pageToken);

    const entriesRes = await fetch(entriesUrl, {
      headers: { Authorization: `Bearer ${googleAccessToken}` },
    });
    const entriesData = await entriesRes.json();
    if (!entriesRes.ok) {
      throw new Error(entriesData.error?.message || "Failed to load transcript entries.");
    }

    entries = entries.concat(entriesData.transcriptEntries || []);
    pageToken = entriesData.nextPageToken || "";
  } while (pageToken);

  return entries.map((entry) => entry.text || "").join("\n");
}
