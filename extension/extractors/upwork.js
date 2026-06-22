(() => {
  const common = globalThis.JobApplicationExtractorCommon;
  const { absoluteUrl, clean, expandDetailsIfNeeded, firstElement, firstText, opportunity, selectedText, unique } = common;

  function upworkSkills(root) {
    const domSkills = Array.from(
      root.querySelectorAll(
        '[data-qa-skill-key] span, [data-qa-skill-uid] span, [data-test="attr-item"], a[href*="ontology_skill_uid"], a[href*="/cat/"], a[href*="/freelance-jobs/"]'
      )
    )
      .map((node) => clean(node.textContent || ""))
      .filter(Boolean);
    return unique(domSkills);
  }

  function upworkSkillsFromRootOrDocument(root) {
    const skills = upworkSkills(root || document);
    return skills.length ? skills : upworkSkills(document);
  }

  function upworkDescription(root = document) {
    const selectors = ['[data-test="job-description"]', '[data-test="Description"]', '[data-test="description"]'];
    if (root.matches?.(selectors.join(", "))) return selectedText(root);
    return selectedText(firstElement(selectors, root));
  }

  function upworkExactHeading(label) {
    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"]')).find((node) => clean(node.textContent) === label) || null;
  }

  function upworkSectionRoot(label) {
    const heading = upworkExactHeading(label);
    return heading?.closest("section") || heading?.parentElement || null;
  }

  function upworkApplyJobDetailsRoot() {
    const heading = upworkExactHeading("Job details");
    let node = heading?.parentElement || null;
    while (node && node !== document.body) {
      if (upworkViewPostingLink(node)) return node;
      node = node.parentElement;
    }
    return heading?.parentElement || null;
  }

  function upworkViewPostingLink(root = document) {
    return Array.from(root.querySelectorAll("a")).find((link) => clean(link.textContent || "") === "View job posting") || null;
  }

  function upworkCleanVisibleDescription(text) {
    return clean(text).replace(/\s+(?:more|less)\s+More\/Less about$/, "");
  }

  function upworkCleanJobDetailDescription(text) {
    return upworkCleanVisibleDescription(text).replace(/^Summary\s*/, "");
  }

  function upworkApplyVisibleDescription(root) {
    const viewPosting = upworkViewPostingLink(root);
    let sibling = viewPosting?.previousElementSibling || null;
    while (sibling) {
      const text = upworkCleanVisibleDescription(sibling.textContent || "");
      if (text) return text;
      sibling = sibling.previousElementSibling;
    }
    const describedParagraph = Array.from(root.querySelectorAll("p"))
      .map((node) => upworkCleanVisibleDescription(node.textContent || ""))
      .find((text) => text && text !== "Posted" && !/^Posted\s/.test(text));
    return describedParagraph || upworkDescription(root);
  }

  async function upworkApplyVisibleOpportunity() {
    const detailsRoot = upworkApplyJobDetailsRoot();
    if (!detailsRoot) return null;
    await expandDetailsIfNeeded(detailsRoot);
    const skillsRoot = upworkSectionRoot("Skills and expertise");
    const viewPosting = upworkViewPostingLink(detailsRoot);
    if (!viewPosting) return null;
    const title = firstText(['[data-test="job-title"]', '[data-test="job-details-title"]', '[role="heading"][aria-level="3"]', '[aria-level="3"]', 'h3', 'h4'], detailsRoot);
    const description = upworkApplyVisibleDescription(detailsRoot);
    return opportunity("upwork", {
      source_url: absoluteUrl(viewPosting?.getAttribute("href") || "") || location.href,
      title,
      description,
      skills: upworkSkills(skillsRoot || document),
      extraction_warnings: [
        ...(title ? [] : ["Upwork apply-page visible job title was not found in the Job details section."]),
        ...(description ? [] : ["Upwork apply-page visible job description was not found in the Job details section."]),
      ],
    });
  }

  function upworkJobDetailsVisibleTitle() {
    const summaryHeading = upworkExactHeading("Skills and Expertise") || upworkExactHeading("Preferred qualifications");
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"]')).filter((node) => {
      const text = clean(node.textContent || "");
      if (!text) return false;
      if (["Skills and Expertise", "Preferred qualifications", "Activity on this job", "About the client", "Footer navigation"].includes(text)) return false;
      return !summaryHeading || Boolean(node.compareDocumentPosition(summaryHeading) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    return clean(headings.at(-1)?.textContent || "");
  }

  function upworkJobDetailsVisibleDescription() {
    const description = upworkCleanJobDetailDescription(upworkDescription(document));
    if (description) return description;

    const summary = Array.from(document.querySelectorAll("p, div, span")).find((node) => clean(node.textContent || "") === "Summary");
    let node = summary?.nextElementSibling || null;
    while (node) {
      const text = upworkCleanJobDetailDescription(node.textContent || "");
      if (text) return text;
      node = node.nextElementSibling;
    }
    return "";
  }

  function upworkJobDetailsVisibleOpportunity() {
    if (!location.pathname.startsWith("/jobs/")) return null;
    const title = firstText(['[data-test="job-title"]', '[data-test="job-tile-title"]', '[data-test="Title"]']) || upworkJobDetailsVisibleTitle();
    const description = upworkJobDetailsVisibleDescription();
    const skillsRoot = upworkSectionRoot("Skills and Expertise");
    const skills = upworkSkillsFromRootOrDocument(skillsRoot);
    return opportunity("upwork", {
      title,
      description,
      skills,
      extraction_warnings: [
        ...(title ? [] : ["Upwork job-detail visible title was not found."]),
        ...(description ? [] : ["Upwork job-detail visible description was not found."]),
        ...(skills.length ? [] : ["Upwork job-detail visible skills were not found."]),
      ],
    });
  }

  function upworkApplyState() {
    const jobApply = globalThis.__NUXT__?.state?.["job-apply"];
    const ciphertext = clean(jobApply?.ciphertext || "");
    const cachedOpening = ciphertext ? jobApply?.openingsCache?.[ciphertext] : null;
    const firstCachedOpening = Object.values(jobApply?.openingsCache || {})[0];
    const job =
      jobApply?.jobDetails?.opening?.job ||
      jobApply?.originalOpening?.opening?.job ||
      jobApply?.originalOpening?.job ||
      cachedOpening?.opening?.job ||
      cachedOpening?.job ||
      firstCachedOpening?.opening?.job ||
      firstCachedOpening?.job;
    if (!job) return null;
    return { jobApply, job };
  }

  function upworkJobDetailsState() {
    const jobDetails = globalThis.__NUXT__?.state?.jobDetails || globalThis.__NUXT__?.vuex?.jobDetails;
    const job = jobDetails?.job;
    if (!job) return null;
    return { jobDetails, job };
  }

  function upworkProposalDetailsState() {
    const proposalDetails = globalThis.__NUXT__?.state?.["proposal-details"]?.proposalDetailsV3Response;
    const job = proposalDetails?.jobDetails?.opening?.job;
    if (!job) return null;
    return { proposalDetails, job };
  }

  function upworkStructuredSourceUrl(job, sourceCiphertext = "") {
    const ciphertext = clean(job?.info?.ciphertext || sourceCiphertext);
    if (ciphertext) return absoluteUrl(`/jobs/${ciphertext}`);
    const detailCiphertext = clean(job?.ciphertext || "");
    if (!detailCiphertext) return location.href;
    return absoluteUrl(`/jobs/${detailCiphertext}`);
  }

  function upworkApplySourceUrl(jobApply, job) {
    const originalPosting = absoluteUrl(document.querySelector('a[data-test="open-original-posting"]')?.getAttribute("href") || "");
    if (originalPosting) return originalPosting;
    return upworkStructuredSourceUrl(job, jobApply?.ciphertext || "");
  }

  function upworkSandsSkills(sandsData) {
    return unique((sandsData?.ontologySkills || []).flatMap((skill) => {
      const children = Array.isArray(skill?.children) ? skill.children.map((child) => clean(child?.prefLabel || child?.name || "")) : [];
      return children.length ? children : [clean(skill?.prefLabel || skill?.name || "")];
    }));
  }

  function upworkApplyOpportunity() {
    const state = upworkApplyState();
    if (!state) return null;
    const { jobApply, job } = state;
    const title = clean(job?.info?.title || job?.title || "");
    const description = upworkCleanVisibleDescription(job?.description || "");
    return opportunity("upwork", {
      source_url: upworkApplySourceUrl(jobApply, job),
      title,
      description,
      skills: upworkSandsSkills(job?.sandsData || job?.sands),
      extraction_warnings: [
        ...(title ? [] : ["Upwork apply-page job title was not found in Nuxt job state."]),
        ...(description ? [] : ["Upwork apply-page job description was not found in Nuxt job state."]),
      ],
    });
  }

  function upworkJobDetailsOpportunity() {
    const state = upworkJobDetailsState();
    if (!state) return null;
    const { jobDetails, job } = state;
    const title = clean(job?.title || jobDetails?.seo?.title || "");
    const description = upworkCleanVisibleDescription(job?.description || jobDetails?.seo?.description || "");
    return opportunity("upwork", {
      source_url: upworkStructuredSourceUrl(job),
      title,
      description,
      skills: upworkSandsSkills(jobDetails?.sands || job?.sandsData || job?.sands),
      extraction_warnings: [
        ...(title ? [] : ["Upwork job-detail title was not found in Nuxt job state."]),
        ...(description ? [] : ["Upwork job-detail description was not found in Nuxt job state."]),
      ],
    });
  }

  function upworkProposalDetailsOpportunity() {
    const state = upworkProposalDetailsState();
    if (!state) return null;
    const { proposalDetails, job } = state;
    const title = clean(job?.info?.title || job?.title || "");
    const description = upworkCleanVisibleDescription(job?.description || "");
    return opportunity("upwork", {
      source_url: upworkStructuredSourceUrl(job),
      title,
      description,
      skills: upworkSandsSkills(job?.sandsData || job?.sands || proposalDetails?.jobDetails?.sands),
      extraction_warnings: [
        ...(title ? [] : ["Upwork proposal-details job title was not found in Nuxt proposal state."]),
        ...(description ? [] : ["Upwork proposal-details job description was not found in Nuxt proposal state."]),
      ],
    });
  }

  function upworkProposalDetailsRoot() {
    return document.querySelector('[data-test="proposal-details"]');
  }

  function upworkProposalJobDetailsRoot() {
    const root = upworkProposalDetailsRoot();
    if (!root) return null;
    const heading = Array.from(root.querySelectorAll("h2, [role=\"heading\"]")).find((node) => clean(node.textContent) === "Job details");
    const header = heading?.closest("header");
    const details = header?.nextElementSibling;
    return details || heading?.parentElement || null;
  }

  function upworkProposalVisibleDescription(detailsRoot) {
    const toggle = detailsRoot.querySelector('button[data-ev-label="truncation_toggle"]');
    const descriptionRoot = toggle?.parentElement;
    const description = upworkCleanVisibleDescription(descriptionRoot?.textContent || "");
    if (description) return description;
    return upworkDescription(detailsRoot);
  }

  async function upworkProposalVisibleOpportunity() {
    const detailsRoot = upworkProposalJobDetailsRoot();
    if (!detailsRoot) return null;
    await expandDetailsIfNeeded(detailsRoot);
    const title = firstText(['h3'], detailsRoot);
    const description = upworkProposalVisibleDescription(detailsRoot);
    const skills = upworkSkills(detailsRoot);
    return opportunity("upwork", {
      title,
      description,
      skills,
      extraction_warnings: [
        ...(title ? [] : ["Upwork proposal-details visible title was not found."]),
        ...(description ? [] : ["Upwork proposal-details visible description was not found."]),
        ...(skills.length ? [] : ["Upwork proposal-details visible skills were not found."]),
      ],
    });
  }

  function proposalJobDetailsRoot() {
    return document.querySelector('[data-test="job-details"], [data-test="job-description"], [data-test="Description"]');
  }

  function firstUpworkJobCard() {
    return document.querySelector('[data-test="job-tile"]');
  }

  function extractProposalSkills(root) {
    const skills = Array.from(root.querySelectorAll("[data-qa-skill-key] span, [data-qa-skill-uid] span"))
      .map((node) => clean(node.textContent || ""))
      .filter(Boolean);
    return unique(skills);
  }

  globalThis.JobApplicationExtractors.register({
    id: "upwork",
    matches: () => location.hostname.includes("upwork.com"),
    async extract() {
      const applyStateOpportunity = upworkApplyOpportunity();
      if (applyStateOpportunity) return applyStateOpportunity;

      const jobDetailsStateOpportunity = upworkJobDetailsOpportunity();
      if (jobDetailsStateOpportunity?.title && jobDetailsStateOpportunity?.description && jobDetailsStateOpportunity.skills.length) {
        return jobDetailsStateOpportunity;
      }

      const proposalDetailsStateOpportunity = upworkProposalDetailsOpportunity();
      if (proposalDetailsStateOpportunity?.title && proposalDetailsStateOpportunity?.description && proposalDetailsStateOpportunity.skills.length) {
        return proposalDetailsStateOpportunity;
      }

      const visibleApplyOpportunity = await upworkApplyVisibleOpportunity();
      if (visibleApplyOpportunity) return visibleApplyOpportunity;

      const visibleJobDetailsOpportunity = upworkJobDetailsVisibleOpportunity();
      if (visibleJobDetailsOpportunity) return visibleJobDetailsOpportunity;

      const visibleProposalDetailsOpportunity = await upworkProposalVisibleOpportunity();
      if (visibleProposalDetailsOpportunity) return visibleProposalDetailsOpportunity;

      if (jobDetailsStateOpportunity) return jobDetailsStateOpportunity;

      if (proposalDetailsStateOpportunity) return proposalDetailsStateOpportunity;

      const proposalDetails = proposalJobDetailsRoot();
      if (proposalDetails) {
        await expandDetailsIfNeeded(proposalDetails);
        const description = upworkDescription(proposalDetails);
        return opportunity("upwork", {
          title: firstText(['[data-test="job-title"]', '[data-test="job-tile-title"]', '[data-test="Title"]'], proposalDetails),
          description,
          skills: extractProposalSkills(proposalDetails),
          recruiter_or_client_context: "",
          extraction_warnings: description ? [] : ["Upwork job description element was not found; review the snapshot before drafting."],
        });
      }

      const card = firstUpworkJobCard();
      const root = card || document;
      const description = upworkDescription(root);
      return opportunity("upwork", {
        title:
          firstText([
            '[data-test="job-title"]',
            '[data-test="job-tile-title"]',
            '[data-test="Title"]',
          ], root),
        description,
        skills: upworkSkills(root),
        recruiter_or_client_context: firstText([
          '[data-test="client-info"]',
          '[data-test="client-history"]',
          '[data-test="buyer-info"]',
        ]),
        extraction_warnings: card ? [] : ["Upwork job card was not found; review the snapshot before drafting."],
      });
    },
  });
})();
