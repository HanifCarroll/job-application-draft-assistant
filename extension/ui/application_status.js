(() => {
  function formatAppliedAt(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.split("T", 1)[0];
    return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function applicationSummary(application) {
    const appliedAt = formatAppliedAt(application?.applied_at || "");
    const role = application?.title || "this role";
    const company = application?.company ? ` at ${application.company}` : "";
    return `${appliedAt ? `${appliedAt} · ` : ""}${role}${company}`;
  }

  function setAppliedIndicator({ els, application, setCurrentApplicationMatch, setApplicationControls }) {
    setCurrentApplicationMatch(application || null);
    if (!application) {
      els.appliedIndicator.hidden = true;
      els.appliedSummary.textContent = "";
      setApplicationControls();
      return;
    }
    els.appliedSummary.textContent = applicationSummary(application);
    els.appliedIndicator.hidden = false;
    setApplicationControls();
  }

  function buildApplicationLogRequest({ readRequest, nowIso, currentDraftId, currentDraftJobId }) {
    const request = readRequest();
    return {
      opportunity: request.opportunity,
      applied_at: nowIso(),
      draft_id: currentDraftId(),
      draft_job_id: currentDraftJobId(),
      detected_by: "manual",
      warnings: [],
    };
  }

  globalThis.JobApplicationStatusUi = {
    buildApplicationLogRequest,
    setAppliedIndicator,
  };
})();
