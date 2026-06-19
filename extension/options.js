const DEFAULT_API_BASE = "http://127.0.0.1:8787";
const API_BASE_KEY = "jobApplicationDraftBackendUrl";

const els = {
  form: document.querySelector("#settings"),
  backendUrl: document.querySelector("#backend-url"),
  test: document.querySelector("#test"),
  status: document.querySelector("#status"),
};

function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function setStatus(text, state = "idle") {
  els.status.textContent = text;
  els.status.dataset.state = state;
}

async function load() {
  const stored = await chrome.storage.local.get(API_BASE_KEY);
  els.backendUrl.value = stored[API_BASE_KEY] || DEFAULT_API_BASE;
}

async function save() {
  const value = normalizeUrl(els.backendUrl.value || DEFAULT_API_BASE);
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Use an http or https URL.");
  }
  await chrome.storage.local.set({ [API_BASE_KEY]: value });
  els.backendUrl.value = value;
  setStatus("Saved.");
  return value;
}

async function test() {
  const apiBase = await save();
  const response = await fetch(`${apiBase}/health`);
  if (!response.ok) throw new Error(`Backend returned ${response.status}.`);
  const health = await response.json();
  setStatus(`Connected. ${health.project_count || 0} context projects indexed.`);
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await save();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

els.test.addEventListener("click", async () => {
  try {
    setStatus("Testing backend...");
    await test();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

load().catch((error) => setStatus(error.message, "error"));
