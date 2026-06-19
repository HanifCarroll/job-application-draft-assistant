const DEFAULT_API_BASE = "http://127.0.0.1:8787";
const API_BASE_KEY = "upworkProposalBackendUrl";
const DRAFT_STATE_KEY = "upworkProposalDraftState";

function nowIso() {
  return new Date().toISOString();
}

async function saveDraftState(state) {
  await chrome.storage.local.set({
    [DRAFT_STATE_KEY]: {
      ...state,
      updated_at: nowIso(),
    },
  });
}

async function loadDraftState() {
  const stored = await chrome.storage.local.get(DRAFT_STATE_KEY);
  return stored[DRAFT_STATE_KEY] || {};
}

async function patchDraftState(patch) {
  const existing = await loadDraftState();
  await saveDraftState({ ...existing, ...patch });
}

async function backendUrl() {
  const stored = await chrome.storage.local.get(API_BASE_KEY);
  return (stored[API_BASE_KEY] || DEFAULT_API_BASE).replace(/\/+$/, "");
}

async function responseErrorMessage(response) {
  const text = await response.text();
  if (!text) return `Backend returned ${response.status}`;
  try {
    const payload = JSON.parse(text);
    return payload?.detail || text;
  } catch (_error) {
    return text;
  }
}

async function startDraftJob(request) {
  const startedAt = nowIso();
  await saveDraftState({
    phase: "starting",
    request,
    started_at: startedAt,
    draft_text: "",
    audit: "",
    error: null,
  });

  try {
    const apiBase = await backendUrl();
    const response = await fetch(`${apiBase}/draft-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }

    const job = await response.json();
    const state = {
      phase: "active",
      request,
      job_id: job.id,
      job,
      started_at: startedAt,
      draft_text: "",
      audit: "",
      error: null,
    };
    await saveDraftState(state);
    return { ok: true, state };
  } catch (error) {
    const message = error?.message || String(error);
    await saveDraftState({
      phase: "failed",
      request,
      started_at: startedAt,
      draft_text: "",
      audit: "",
      error: message,
    });
    return { ok: false, error: message };
  }
}

async function startPdfExport(draftId) {
  const startedAt = nowIso();
  await patchDraftState({
    pdf_status: "generating",
    pdf_error: null,
    pdf: null,
    pdf_started_at: startedAt,
  });

  try {
    const apiBase = await backendUrl();
    const response = await fetch(`${apiBase}/drafts/${encodeURIComponent(draftId)}/pdf`, { method: "POST" });
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }

    const pdf = await response.json();
    const state = {
      ...(await loadDraftState()),
      pdf_status: "succeeded",
      pdf_error: null,
      pdf,
      pdf_finished_at: nowIso(),
    };
    await saveDraftState(state);
    return { ok: true, state, pdf };
  } catch (error) {
    const message = error?.message || String(error);
    const state = {
      ...(await loadDraftState()),
      pdf_status: "failed",
      pdf_error: message,
      pdf_finished_at: nowIso(),
    };
    await saveDraftState(state);
    return { ok: false, state, error: message };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_DRAFT_JOB") {
    startDraftJob(message.request)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message?.type === "START_PDF_EXPORT") {
    startPdfExport(message.draft_id)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  return false;
});
