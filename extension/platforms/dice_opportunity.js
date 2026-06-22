(() => {
  if (globalThis.JobApplicationDiceOpportunity) {
    return;
  }

  const common = globalThis.JobApplicationExtractorCommon;
  const { absoluteUrl, clean, htmlToText, opportunity, selectedText, unique } = common;

  function flattenJsonLd(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
    if (typeof value !== "object") return [];
    const graph = Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flattenJsonLd) : [];
    return [value, ...graph];
  }

  function jsonLdObjects(root = document) {
    const values = [];
    for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        values.push(...flattenJsonLd(parsed));
      } catch (_error) {
        // Ignore malformed structured data from third-party pages.
      }
    }
    return values;
  }

  function jobPostingJsonLd(root = document) {
    return jsonLdObjects(root).find((item) => {
      const type = item["@type"];
      return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
    });
  }

  function jsonLdStringList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(jsonLdStringList);
    if (typeof value === "object") {
      return [value.name, value.value, value.termCode].flatMap(jsonLdStringList);
    }
    return clean(String(value)).split(/[,;|]/).map(clean).filter(Boolean);
  }

  function orgName(value) {
    if (!value) return "";
    if (Array.isArray(value)) return orgName(value[0]);
    if (typeof value === "object") return clean(value.name || "");
    return clean(String(value));
  }

  function locationFromJsonLd(job) {
    const requirements = job?.applicantLocationRequirements;
    const jobLocation = Array.isArray(job?.jobLocation) ? job.jobLocation[0] : job?.jobLocation;
    const address = jobLocation?.address;
    return clean(
      [
        job?.jobLocationType === "TELECOMMUTE" ? "Remote" : "",
        orgName(requirements),
        address?.addressLocality,
        address?.addressRegion,
        address?.addressCountry,
      ]
        .filter(Boolean)
        .join(", ")
    );
  }

  function employmentTypeFromJsonLd(job) {
    const value = jsonLdStringList(job?.employmentType).join(" ");
    if (!value) return "";
    const normalized = value.toUpperCase().replace(/[_\s]+/g, "_");
    const labels = {
      CONTRACTOR: "Contract",
      TEMPORARY: "Contract",
      FULL_TIME: "Full-time",
      PART_TIME: "Part-time",
    };
    return labels[normalized] || clean(value);
  }

  function visibleSkillChips(root = document) {
    const jobDetailsHeading = Array.from(root.querySelectorAll('h2')).find((node) => clean(node.textContent) === "Job Details");
    const jobDetailsSection = jobDetailsHeading?.parentElement;
    if (!jobDetailsSection) return [];
    const skillsHeading = Array.from(jobDetailsSection.querySelectorAll('h3')).find((node) => clean(node.textContent) === "Skills");
    const skillsList = skillsHeading?.nextElementSibling;
    if (skillsList?.tagName !== "UL") return [];
    return unique(Array.from(skillsList.children).map((node) => clean(node.textContent || "")));
  }

  async function waitForVisibleSkillChips(timeoutMs = 2500) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (visibleSkillChips().length > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  function jobSkills(job) {
    return unique([
      ...jsonLdStringList(job?.skills),
      ...jsonLdStringList(job?.occupationalCategory),
      ...visibleSkillChips(),
    ]);
  }

  function easyApplyLink(root = document) {
    return Array.from(root.querySelectorAll('a')).find((link) => clean(link.textContent || link.getAttribute("aria-label") || "") === "Easy Apply") || null;
  }

  function isDiceApplicationWizardUrl(value) {
    const url = absoluteUrl(value);
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname.includes("dice.com") && /^\/job-applications\/[^/]+\/wizard(?:\/|$)/.test(parsed.pathname);
    } catch (_error) {
      return false;
    }
  }

  function searchResultPostings(root = document) {
    if (!location.hostname.includes("dice.com") || location.pathname !== "/jobs") return [];
    const seenUrls = new Set();
    const postings = [];
    for (const card of root.querySelectorAll('[data-testid="job-card"]')) {
      const easyApply = easyApplyLink(card);
      if (!easyApply) continue;
      const link = card.querySelector('[data-testid="job-search-job-detail-link"]');
      const title = clean(link?.textContent || "");
      const url = absoluteUrl(link?.getAttribute("href") || "");
      if (!title || !url || seenUrls.has(url)) continue;
      seenUrls.add(url);
      postings.push({
        title,
        url,
        easy_apply_url: absoluteUrl(easyApply.getAttribute("href") || "") || url,
      });
    }
    return postings;
  }

  function detailEasyApplyLink(root = document) {
    if (!location.hostname.includes("dice.com") || !location.pathname.startsWith("/job-detail/")) return null;
    const link = root.querySelector('[data-testid="apply-button"]');
    if (!link || !isDiceApplicationWizardUrl(link.getAttribute("href") || "")) return null;
    return link;
  }

  async function waitForDetailEasyApplyLink(timeoutMs = 8000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const link = detailEasyApplyLink();
      if (link) return link;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return null;
  }

  async function clickDetailEasyApply() {
    const link = await waitForDetailEasyApplyLink();
    if (!link) {
      return { clicked: false, error: "Dice Easy Apply control was not found on the detail page." };
    }
    const nextUrl = absoluteUrl(link.getAttribute("href") || "");
    return { clicked: true, next_url: nextUrl };
  }

  function companyContext(company) {
    const companyInfoHeading = Array.from(document.querySelectorAll('h2')).find((node) => clean(node.textContent) === "Company Info");
    const card = companyInfoHeading?.parentElement;
    if (!card) return "";
    const aboutHeading = Array.from(card.querySelectorAll('h3')).find((node) => clean(node.textContent) === `About ${company}`);
    if (!aboutHeading) return "";
    return selectedText(card.querySelector('[data-testid="richTextElement"]'));
  }

  async function detailOpportunity(jobId) {
    const sourceUrl = new URL(`/job-detail/${jobId}`, location.origin).href;
    try {
      const response = await fetch(sourceUrl, { credentials: "include" });
      if (!response.ok) return null;
      const documentText = await response.text();
      const parsed = new DOMParser().parseFromString(documentText, "text/html");
      const job = jobPostingJsonLd(parsed);
      if (!job?.title) return null;
      const company = orgName(job.hiringOrganization);
      return opportunity("dice", {
        source_url: clean(job.url) || sourceUrl,
        title: clean(job.title),
        company,
        location: locationFromJsonLd(job),
        employment_type: employmentTypeFromJsonLd(job),
        description: htmlToText(job.description),
        skills: unique([
          ...jsonLdStringList(job.skills),
          ...jsonLdStringList(job.occupationalCategory),
        ]),
        extraction_warnings: company ? [] : ["Dice structured job details did not include company."],
      });
    } catch (_error) {
      return null;
    }
  }

  function wizardHeaderText(detailLink) {
    let element = detailLink;
    for (let depth = 0; depth < 6 && element; depth += 1) {
      const text = clean(element.textContent || "");
      if (/^.+?\s*@\s*.+?\s+in\s+.+$/.test(text)) return text;
      element = element.parentElement;
    }
    return "";
  }

  function wizardPageOpportunity(jobId) {
    const detailLink = document.querySelector(`a[href="/job-detail/${jobId}"], a[href^="/job-detail/${jobId}?"]`);
    const sourceUrl = new URL(detailLink?.getAttribute("href") || `/job-detail/${jobId}`, location.origin).href;
    if (!detailLink) return null;
    const title = clean(detailLink.textContent || "");
    if (!title) return null;
    const detailMatch = wizardHeaderText(detailLink).match(/^(.+?)\s*@\s*(.+?)\s+in\s+(.+)$/);
    return opportunity("dice", {
      source_url: sourceUrl,
      title,
      company: clean(detailMatch?.[2] || ""),
      location: clean(detailMatch?.[3] || ""),
      extraction_warnings: detailMatch ? [] : ["Dice application wizard header did not expose company and location."],
    });
  }

  globalThis.JobApplicationDiceOpportunity = {
    clickDetailEasyApply,
    companyContext,
    detailOpportunity,
    employmentTypeFromJsonLd,
    isDiceApplicationWizardUrl,
    jobPostingJsonLd,
    jobSkills,
    locationFromJsonLd,
    orgName,
    searchResultPostings,
    waitForVisibleSkillChips,
    wizardPageOpportunity,
  };
})();
