(() => {
  if (globalThis.JobApplicationLedgerBadge) {
    return;
  }

  const LEDGER_BADGE_ID = "job-application-ledger-badge";
  let visibleSourceUrl = "";

  function formatAppliedAt(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.split("T", 1)[0];
    return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function set(application, { label = "Already applied", includeAppliedAt = true, sourceUrl = "" } = {}) {
    const existing = document.getElementById(LEDGER_BADGE_ID);
    if (!application) {
      existing?.remove();
      visibleSourceUrl = "";
      return;
    }
    const badge = existing || document.createElement("div");
    const badgeSourceUrl = sourceUrl || application.source_url || "";
    visibleSourceUrl = badgeSourceUrl;
    badge.id = LEDGER_BADGE_ID;
    badge.dataset.sourceUrl = badgeSourceUrl;
    badge.setAttribute("role", "status");
    badge.style.position = "fixed";
    badge.style.right = "18px";
    badge.style.bottom = "18px";
    badge.style.zIndex = "2147483647";
    badge.style.maxWidth = "320px";
    badge.style.border = "1px solid #b8d8ca";
    badge.style.borderRadius = "8px";
    badge.style.padding = "10px 12px";
    badge.style.background = "#e3f1eb";
    badge.style.boxShadow = "0 10px 28px rgba(23, 32, 28, 0.14)";
    badge.style.color = "#15533f";
    badge.style.font = "700 13px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const appliedAt = includeAppliedAt ? formatAppliedAt(application.applied_at) : "";
    const role = application.title || "this role";
    const company = application.company ? ` at ${application.company}` : "";
    badge.textContent = `${label}${appliedAt ? ` ${appliedAt}` : ""}: ${role}${company}`;
    if (!existing) {
      document.documentElement.appendChild(badge);
    }
  }

  globalThis.JobApplicationLedgerBadge = {
    clear: () => set(null),
    set,
    sourceUrl: () => visibleSourceUrl,
  };
})();
