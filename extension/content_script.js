(() => {
  if (globalThis.__upworkProposalAssistantLoaded) {
    return;
  }
  globalThis.__upworkProposalAssistantLoaded = true;

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function firstText(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = clean(element?.textContent || "");
      if (text) return text;
    }
    return "";
  }

  function findHeading(text) {
    return Array.from(document.querySelectorAll("h1, h2, h3, h4"))
      .find((node) => clean(node.textContent || "").toLowerCase() === text.toLowerCase()) || null;
  }

  function proposalJobDetailsRoot() {
    const heading = findHeading("Job details");
    if (!heading) return null;

    let node = heading.parentElement;
    for (let depth = 0; depth < 8 && node; depth += 1) {
      const text = clean(node.textContent || "");
      if (text.includes("Skills and expertise") || text.includes("View job posting")) {
        return node;
      }
      node = node.parentElement;
    }

    const container = heading.closest("div");
    const next = container?.parentElement?.querySelector("section");
    return next || container;
  }

  function firstJobCard() {
    const links = Array.from(document.querySelectorAll('a[href*="/jobs/"], a[href*="/freelance-jobs/"]'))
      .filter((node) => clean(node.textContent || "").length > 20);
    const link = links[0];
    if (!link) return { link: null, card: null };

    let card = link;
    let best = link.parentElement;
    for (let depth = 0; depth < 8 && card?.parentElement; depth += 1) {
      card = card.parentElement;
      const text = clean(card.textContent || "");
      if (text.includes("Proposals:")) best = card;
      if (text.includes("Hourly:") || text.includes("Fixed-price") || text.length > 1000) {
        return { link, card };
      }
    }
    return { link, card: best };
  }

  function visibleText() {
    return clean(document.body?.innerText || "");
  }

  function extractBudget(text) {
    const hourly =
      text.match(/Hourly:\s*\$[\d,]+(?:\.\d+)?\s*-\s*\$[\d,]+(?:\.\d+)?/i) ||
      text.match(/\$[\d,]+(?:\.\d+)?\s*-\s*\$[\d,]+(?:\.\d+)?(?:\s*\/?\s*hr)?/i);
    const fixed = text.match(/(?:Fixed-price|Fixed price|Budget):?\s*\$[\d,]+(?:\.\d+)?/i) || text.match(/\$[\d,]+(?:\.\d+)?\s*(?:fixed)?/i);
    return clean(hourly?.[0] || fixed?.[0] || "");
  }

  function extractSkills(root = document) {
    const blocked = new Set([
      "Just not interested",
      "Vague Description",
      "Unrealistic Expectations",
      "Too Many Applicants",
      "Doesn't Match Skills",
      "I am overqualified",
      "Budget too low",
      "Not in my preferred location",
      "Skip skills",
    ]);
    const candidates = Array.from(
      root.querySelectorAll(
        '[data-test*="skill" i], [data-test="attr-item"], a[href*="ontology_skill_uid"], a[href*="/cat/"], a[href*="/freelance-jobs/"]'
      )
    )
      .map((node) => clean(node.textContent || ""))
      .filter((text) => text.length > 1 && text.length < 40 && !blocked.has(text));
    return Array.from(new Set(candidates)).slice(0, 20);
  }

  function extractProposalSkills(root) {
    const skills = Array.from(root.querySelectorAll("[data-qa-skill-key] span, [data-qa-skill-uid] span"))
      .map((node) => clean(node.textContent || ""))
      .filter(Boolean);
    return Array.from(new Set(skills)).slice(0, 20);
  }

  async function expandDetailsIfNeeded(detailsRoot) {
    const toggle = detailsRoot.querySelector('button[data-ev-label="truncation_toggle"][aria-expanded="false"]');
    if (!toggle) return;
    toggle.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  async function extractProposalProject(detailsRoot) {
    await expandDetailsIfNeeded(detailsRoot);
    const detailsText = clean(detailsRoot.textContent || "");
    const title = clean(detailsRoot.querySelector("h3")?.textContent || "");
    return {
      title,
      description: detailsText,
      budget: extractBudget(detailsText || visibleText()),
      skills: extractProposalSkills(detailsRoot),
      client_context: "",
      url: location.href,
      captured_at: new Date().toISOString(),
    };
  }

  async function extractProject() {
    const proposalDetails = proposalJobDetailsRoot();
    if (proposalDetails) {
      const proposalProject = await extractProposalProject(proposalDetails);
      if (proposalProject.title && proposalProject.description) {
        return proposalProject;
      }
    }

    const { link, card } = firstJobCard();
    const cardText = clean(card?.textContent || "");
    const text = visibleText();
    const title = firstText([
      'h1[data-test="job-title"]',
      '[data-test="job-title"]',
      "h1",
      '[data-test="Title"]',
    ]) || clean(link?.textContent || "");
    const description = firstText([
      '[data-test="Description"]',
      '[data-test="job-description"]',
      '[data-test="description"]',
      "article",
    ]);
    const clientContext = firstText([
      '[data-test="client-info"]',
      '[data-test="client-history"]',
      '[data-test="buyer-info"]',
      "aside",
    ]);
    return {
      title,
      description: description || cardText || text.slice(0, 5000),
      budget: extractBudget(cardText || text),
      skills: extractSkills(card || document),
      client_context: clientContext,
      url: location.href,
      captured_at: new Date().toISOString(),
    };
  }

  globalThis.__upworkProposalAssistantExtract = extractProject;

  if (globalThis.chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "UPWORK_PROPOSAL_EXTRACT") return false;
      extractProject()
        .then((project) => sendResponse({ ok: true, project }))
        .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
      return true;
    });
  }
})();
