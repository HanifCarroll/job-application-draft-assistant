const els = {
  status: document.querySelector("#status"),
  refresh: document.querySelector("#refresh"),
  dicePostingPicker: document.querySelector("#dice-posting-picker"),
  dicePostingSummary: document.querySelector("#dice-posting-summary"),
  dicePostingNextPage: document.querySelector("#dice-posting-next-page"),
  dicePostingSelectAll: document.querySelector("#dice-posting-select-all"),
  dicePostingList: document.querySelector("#dice-posting-list"),
  dicePostingOpenSelected: document.querySelector("#dice-posting-open-selected"),
  dicePostingStatus: document.querySelector("#dice-posting-status"),
};

let diceResultsTabId = null;

function setStatus(text, state = "idle") {
  els.status.textContent = text;
  els.status.dataset.state = state;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isDiceResultsUrl(value) {
  try {
    const url = new URL(value || "");
    return url.hostname.includes("dice.com") && url.pathname === "/jobs";
  } catch (_error) {
    return false;
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  return tab;
}

async function diceResultsTab() {
  if (diceResultsTabId) {
    try {
      const tab = await chrome.tabs.get(diceResultsTabId);
      if (tab?.id && isDiceResultsUrl(tab.url || "")) return tab;
    } catch (_error) {
      diceResultsTabId = null;
    }
  }

  const tab = await activeTab();
  if (!isDiceResultsUrl(tab.url || "")) {
    throw new Error("Open a Dice results page to use this panel.");
  }
  diceResultsTabId = tab.id;
  return tab;
}

async function injectContentScripts(tabId) {
  await globalThis.JobApplicationContentScripts.inject(tabId);
}

const postingPicker = globalThis.JobApplicationDicePostingPicker.create({
  els,
  activeTab: diceResultsTab,
  injectContentScripts,
  setStatus,
  sleep,
});

function setBusy(isBusy) {
  els.refresh.disabled = isBusy;
  if (isBusy) {
    els.dicePostingNextPage.disabled = true;
    els.dicePostingOpenSelected.disabled = true;
    els.dicePostingSelectAll.disabled = true;
  }
}

postingPicker.attachEvents();

els.refresh.addEventListener("click", async () => {
  try {
    setBusy(true);
    els.dicePostingStatus.textContent = "Refreshing...";
    await postingPicker.refresh();
    els.dicePostingStatus.textContent = `${postingPicker.count()} Easy Apply on this page.`;
    setStatus("Dice results ready.");
  } catch (error) {
    els.dicePostingStatus.textContent = error.message || "Could not refresh Dice postings.";
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
});

async function initializeSidePanel() {
  try {
    setBusy(true);
    await postingPicker.refresh();
    els.dicePostingStatus.textContent = `${postingPicker.count()} Easy Apply on this page.`;
    setStatus("Dice results ready.");
  } catch (error) {
    postingPicker.clear();
    els.dicePostingStatus.textContent = error.message || "Could not read Dice postings.";
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

initializeSidePanel();
