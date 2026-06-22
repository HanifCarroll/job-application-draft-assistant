(() => {
  globalThis.__jobApplicationDraftAssistantLoaded = true;

  const common = globalThis.JobApplicationExtractorCommon;
  const registry = globalThis.JobApplicationExtractors;
  const dice = globalThis.JobApplicationDiceOpportunity;

  async function extractOpportunity() {
    const adapter = registry.adapters.find((candidate) => candidate.matches());
    if (!adapter) {
      return common.opportunity("generic", {
        description: "",
        extraction_warnings: ["No site adapter matched this page; no generic page text was extracted."],
      });
    }
    const snapshot = await adapter.extract();
    return {
      ...snapshot,
      source: adapter.id,
      source_url: snapshot.source_url || location.href,
    };
  }

  globalThis.__applicationDraftAssistantExtract = extractOpportunity;
  globalThis.__applicationDraftAssistantListPostings = dice.searchResultPostings;

  if (globalThis.chrome?.runtime?.onMessage && !globalThis.__applicationDraftAssistantMessageListenerInstalled) {
    globalThis.__applicationDraftAssistantMessageListenerInstalled = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "APPLICATION_DRAFT_LIST_POSTINGS") {
        Promise.resolve(globalThis.__applicationDraftAssistantListPostings())
          .then((postings) => sendResponse({ ok: true, postings }))
          .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
        return true;
      }
      if (message?.type === "APPLICATION_DRAFT_CLICK_DICE_EASY_APPLY") {
        dice.clickDetailEasyApply()
          .then((result) => sendResponse({ ok: true, ...result }))
          .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
        return true;
      }
      if (message?.type === "APPLICATION_DRAFT_EXTRACT") {
        globalThis.__applicationDraftAssistantExtract()
          .then((snapshot) => sendResponse({ ok: true, opportunity: snapshot }))
          .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
        return true;
      }
      return false;
    });
  }
})();
