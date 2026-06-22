(() => {
  const common = globalThis.JobApplicationExtractorCommon;
  const { clean, firstText, opportunity, selectedText } = common;

  function zipRecruiterRightPaneOpportunity() {
    const root = document.querySelector('[data-testid="right-pane"]');
    const details = root?.querySelector('[data-testid="job-details-scroll-container"]');
    if (!details) return null;
    const title = clean(details.querySelector('img[alt]')?.getAttribute("alt") || "") || firstText(['h2'], details);
    const company = firstText(['a[href^="/co/"]'], details);
    const locationText = zipRecruiterHeaderLocation(details);
    const description = zipRecruiterDescription(details);
    return opportunity("ziprecruiter", {
      source_url: zipRecruiterSourceUrl(),
      title,
      company,
      location: locationText,
      employment_type: "",
      description,
      skills: [],
      company_context: selectedText(details.querySelector('[data-testid="company-data"]')),
      extraction_warnings: zipRecruiterWarnings({ title, description }),
    });
  }

  function zipRecruiterHeaderLocation(details) {
    const companyLink = details.querySelector('a[href^="/co/"]');
    return selectedText(companyLink?.parentElement?.querySelector('p'));
  }

  function zipRecruiterDescription(details) {
    const heading = Array.from(details.querySelectorAll('h2')).find((node) => clean(node.textContent) === "Job description");
    return selectedText(heading?.nextElementSibling);
  }

  function zipRecruiterReviewDialogOpportunity() {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const headingText = firstText(['section h2'], dialog);
    const title = clean(headingText.replace(/^Applying to\s+/, ""));
    const companyLocation = zipRecruiterCompanyLocation(firstText(['section h3'], dialog));
    return opportunity("ziprecruiter", {
      source_url: zipRecruiterSourceUrl(),
      title,
      company: companyLocation.company,
      location: companyLocation.location,
      employment_type: "",
      description: "",
      skills: [],
      extraction_warnings: zipRecruiterWarnings({ title, description: "" }),
    });
  }

  function zipRecruiterCompanyLocation(value) {
    const parts = clean(value).split(" in ");
    if (parts.length < 2) return { company: clean(value), location: "" };
    const locationText = parts.pop() || "";
    return { company: clean(parts.join(" in ")), location: clean(locationText) };
  }

  function zipRecruiterWarnings({ title, description }) {
    return [
      ...(title ? [] : ["ZipRecruiter selected job title was not found; review the snapshot before drafting."]),
      ...(description ? [] : ["ZipRecruiter job description element was not found; review the snapshot before drafting."]),
    ];
  }

  function zipRecruiterSourceUrl() {
    try {
      const url = new URL(location.href);
      const listingKey = clean(url.searchParams.get("lk") || "");
      if (!listingKey) return location.href;
      const sourceUrl = new URL(url.pathname, url.origin);
      sourceUrl.searchParams.set("lk", listingKey);
      return sourceUrl.href;
    } catch (_error) {
      return location.href;
    }
  }

  function zipRecruiterEmptyOpportunity() {
    return opportunity("ziprecruiter", {
      source_url: zipRecruiterSourceUrl(),
      description: "",
      extraction_warnings: [
        "ZipRecruiter selected job detail region was not found; review the snapshot before drafting.",
        ...zipRecruiterWarnings({ title: "", description: "" }),
      ],
    });
  }

  globalThis.JobApplicationExtractors.register({
    id: "ziprecruiter",
    matches: () => location.hostname.includes("ziprecruiter.com"),
    async extract() {
      return zipRecruiterRightPaneOpportunity() || zipRecruiterReviewDialogOpportunity() || zipRecruiterEmptyOpportunity();
    },
  });
})();
