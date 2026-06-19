(() => {
  if (globalThis.__jobApplicationLoggerLoaded) {
    return;
  }
  globalThis.__jobApplicationLoggerLoaded = true;

  const CONFIRMED_KEY = "jobApplicationLoggerConfirmed";
  const LEDGER_BADGE_ID = "job-application-ledger-badge";

  const PLATFORM_RULES = [
    {
      source: "upwork",
      hosts: ["upwork.com"],
      submitSelectors: [
        'button[data-test="submit-proposal-button"]',
        'button[data-test="submit-proposal"]',
        'button[data-qa="submit-proposal"]',
      ],
      confirmationSelectors: [
        { selector: '[data-test="proposal-submitted-message"]', text: "Your proposal has been submitted" },
        { selector: '[data-test="proposal-submitted"]', text: "Your proposal has been submitted" },
      ],
      confirmationPathPatterns: [/\/ab\/proposals\/submitted\/?$/],
    },
    {
      source: "dice",
      hosts: ["dice.com"],
      submitSelectors: ['button[type="submit"]'],
      submitText: "Submit",
      captureOpportunity: diceWizardOpportunity,
      confirmationPathPatterns: [/\/job-applications\/[^/]+\/wizard\/success\/?$/],
    },
    {
      source: "indeed",
      hosts: ["indeed.com"],
      submitSelectors: ['button[data-testid="indeed-apply-submit-button"]', 'button[data-testid="ia-continueButton"]'],
      confirmationSelectors: [
        { selector: '[data-testid="indeed-apply-confirmation"]', text: "Application submitted" },
        { selector: '[data-testid="ia-ApplicationSubmitted"]', text: "Application submitted" },
      ],
      confirmationPathPatterns: [/\/apply\/confirm\/?$/],
    },
    {
      source: "ziprecruiter",
      hosts: ["ziprecruiter.com"],
      submitSelectors: ['button[data-testid="submit-application"]', 'button[data-testid="apply-submit"]'],
      confirmationSelectors: [
        { selector: '[data-testid="application-submitted"]', text: "Application Submitted" },
        { selector: '[data-testid="apply-confirmation"]', text: "Application Submitted" },
      ],
      confirmationPathPatterns: [/\/candidate\/application\/submitted\/?$/],
    },
    {
      source: "roberthalf",
      hosts: ["roberthalf.com"],
      submitSelectors: ['button[data-testid="submit-application"]', 'button[data-testid="apply-submit"]'],
      confirmationSelectors: [
        { selector: '[data-testid="application-confirmation"]', text: "Application submitted" },
        { selector: '[data-testid="application-submitted"]', text: "Application submitted" },
      ],
      confirmationPathPatterns: [/\/application\/submitted\/?$/],
    },
  ];

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function currentRule() {
    const host = location.hostname.toLowerCase();
    return PLATFORM_RULES.find((rule) => rule.hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) || null;
  }

  async function currentOpportunity(rule) {
    if (rule.captureOpportunity) {
      const captured = rule.captureOpportunity();
      if (captured) return captured;
    }
    if (typeof globalThis.__applicationDraftAssistantExtract !== "function") return null;
    const snapshot = await globalThis.__applicationDraftAssistantExtract();
    if (snapshot?.source !== rule.source) return null;
    if (!snapshot.source_url || !snapshot.title) return null;
    return snapshot;
  }

  function elementConfirms(rule) {
    return rule.confirmationSelectors.some((item) => {
      const element = document.querySelector(item.selector);
      return clean(element?.textContent || "") === item.text;
    });
  }

  function pathConfirms(rule) {
    const path = location.pathname;
    return rule.confirmationPathPatterns.some((pattern) => pattern.test(path));
  }

  function buttonText(element) {
    return clean(element?.textContent || element?.getAttribute("aria-label") || "");
  }

  function matchesSubmit(rule, target) {
    const submit = rule.submitSelectors.map((selector) => target.closest(selector)).find(Boolean);
    if (!submit) return false;
    if (!rule.submitText) return true;
    return buttonText(submit) === rule.submitText;
  }

  function diceWizardOpportunity() {
    const wizardMatch = location.pathname.match(/^\/job-applications\/([^/]+)\/wizard/);
    if (!wizardMatch) return null;
    const detailLink = document.querySelector(`a[href="/job-detail/${wizardMatch[1]}"], a[href^="/job-detail/${wizardMatch[1]}?"]`);
    if (!detailLink) return null;
    const title = clean(detailLink.textContent || "");
    if (!title) return null;
    const headerText = diceWizardHeaderText(detailLink);
    const detailMatch = headerText.match(/^(.+?)\s*@\s*(.+?)\s+in\s+(.+)$/);
    const sourceUrl = new URL(detailLink.getAttribute("href") || `/job-detail/${wizardMatch[1]}`, location.origin).href;
    return {
      source: "dice",
      source_url: sourceUrl,
      captured_at: new Date().toISOString(),
      title,
      company: clean(detailMatch?.[2] || ""),
      location: clean(detailMatch?.[3] || ""),
      employment_type: "",
      description: "",
      responsibilities: [],
      requirements: [],
      nice_to_haves: [],
      skills: [],
      application_questions: [],
      company_context: "",
      recruiter_or_client_context: "",
      extraction_warnings: detailMatch ? [] : ["Dice application wizard header did not expose company and location."],
    };
  }

  function diceWizardHeaderText(detailLink) {
    let element = detailLink;
    for (let depth = 0; depth < 6 && element; depth += 1) {
      const text = clean(element.textContent || "");
      if (/^.+?\s*@\s*.+?\s+in\s+.+$/.test(text)) return text;
      element = element.parentElement;
    }
    return "";
  }

  function formatAppliedAt(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.split("T", 1)[0];
    return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function setLedgerBadge(application) {
    const existing = document.getElementById(LEDGER_BADGE_ID);
    if (!application) {
      existing?.remove();
      return;
    }
    const badge = existing || document.createElement("div");
    badge.id = LEDGER_BADGE_ID;
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
    const appliedAt = formatAppliedAt(application.applied_at);
    const role = application.title || "this role";
    const company = application.company ? ` at ${application.company}` : "";
    badge.textContent = `Already applied${appliedAt ? ` ${appliedAt}` : ""}: ${role}${company}`;
    if (!existing) {
      document.documentElement.appendChild(badge);
    }
  }

  async function lookupApplication(sourceUrl) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "LOOKUP_APPLICATION", source_url: sourceUrl }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          resolve(null);
          return;
        }
        resolve(response.application || null);
      });
    });
  }

  let badgeLookupTimer = 0;
  let lastBadgeLookupKey = "";

  async function updateLedgerBadge({ force = false } = {}) {
    const rule = currentRule();
    if (!rule) {
      setLedgerBadge(null);
      return;
    }
    const opportunity = await currentOpportunity(rule);
    const sourceUrl = opportunity?.source_url || location.href;
    if (!sourceUrl) {
      setLedgerBadge(null);
      return;
    }
    if (!force && sourceUrl === lastBadgeLookupKey) return;
    lastBadgeLookupKey = sourceUrl;
    setLedgerBadge(await lookupApplication(sourceUrl));
  }

  function scheduleLedgerBadgeRefresh(delay = 500, options = {}) {
    window.clearTimeout(badgeLookupTimer);
    badgeLookupTimer = window.setTimeout(() => {
      updateLedgerBadge(options).catch(() => {});
    }, delay);
  }

  async function capturePending(rule) {
    try {
      const opportunity = await currentOpportunity(rule);
      if (!opportunity) return;
      chrome.runtime.sendMessage({ type: "APPLICATION_CAPTURE_PENDING", opportunity }, () => {});
    } catch (_error) {
      return;
    }
  }

  async function confirmIfReady() {
    const rule = currentRule();
    if (!rule) return;
    if (!elementConfirms(rule) && !pathConfirms(rule)) return;
    const key = `${rule.source}:${location.href}`;
    if (sessionStorage.getItem(CONFIRMED_KEY) === key) return;
    sessionStorage.setItem(CONFIRMED_KEY, key);
    chrome.runtime.sendMessage(
      {
        type: "APPLICATION_CONFIRMED",
        source: rule.source,
        warnings: [],
      },
      () => {
        lastBadgeLookupKey = "";
        scheduleLedgerBadgeRefresh(500, { force: true });
      }
    );
  }

  document.addEventListener(
    "click",
    (event) => {
      const rule = currentRule();
      if (!rule) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!matchesSubmit(rule, target)) return;
      capturePending(rule).catch(() => {});
    },
    true
  );

  const observer = new MutationObserver(() => {
    confirmIfReady().catch(() => {});
    scheduleLedgerBadgeRefresh(1200);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  confirmIfReady().catch(() => {});
  scheduleLedgerBadgeRefresh(500);
  window.setTimeout(() => {
    confirmIfReady().catch(() => {});
    scheduleLedgerBadgeRefresh(0);
  }, 1000);
})();
