(() => {
  if (globalThis.JobApplicationExtractorCommon) {
    return;
  }

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function unique(values) {
    return Array.from(new Set(values.map(clean).filter(Boolean)));
  }

  function firstText(selectors, root = document) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      const text = clean(element?.textContent || "");
      if (text) return text;
    }
    return "";
  }

  function selectedText(element) {
    return clean(element?.textContent || "");
  }

  function firstElement(selectors, root = document) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function htmlToText(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    return clean(template.content.textContent || "");
  }

  function absoluteUrl(href) {
    const value = clean(href);
    if (!value) return "";
    try {
      return new URL(value, location.origin).href;
    } catch (_error) {
      return "";
    }
  }

  function opportunity(source, values) {
    const description = clean(values.description);
    const skills = unique(values.skills || []);
    return {
      source,
      source_url: values.source_url || location.href,
      captured_at: new Date().toISOString(),
      title: clean(values.title),
      company: clean(values.company),
      location: clean(values.location),
      employment_type: clean(values.employment_type),
      description,
      responsibilities: values.responsibilities || [],
      requirements: values.requirements || [],
      nice_to_haves: values.nice_to_haves || [],
      skills,
      application_questions: values.application_questions || [],
      company_context: clean(values.company_context),
      recruiter_or_client_context: clean(values.recruiter_or_client_context),
      extraction_warnings: values.extraction_warnings || [],
    };
  }

  async function expandDetailsIfNeeded(detailsRoot) {
    const toggle = detailsRoot.querySelector('button[data-ev-label="truncation_toggle"][aria-expanded="false"]');
    if (!toggle) return;
    toggle.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const registry = globalThis.JobApplicationExtractors || {
    adapters: [],
    register(adapter) {
      this.adapters = this.adapters.filter((candidate) => candidate.id !== adapter.id);
      this.adapters.push(adapter);
    },
  };

  globalThis.JobApplicationExtractors = registry;
  globalThis.JobApplicationExtractorCommon = {
    absoluteUrl,
    clean,
    expandDetailsIfNeeded,
    firstElement,
    firstText,
    htmlToText,
    opportunity,
    selectedText,
    unique,
  };
})();
