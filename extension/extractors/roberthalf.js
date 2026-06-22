(() => {
  const common = globalThis.JobApplicationExtractorCommon;
  const { clean, firstText, htmlToText, opportunity } = common;

  function robertHalfSelectedDetails() {
    return document.querySelector('rhcl-job-card[data-testid="job-details"]') || document.querySelector('rhcl-job-card[selected="true"]');
  }

  function robertHalfDescription(details) {
    const body = firstText(['[data-testid="job-details-description"]'], details || document);
    if (body) return body;
    return htmlToText(details?.getAttribute("copy"));
  }

  function robertHalfSourceUrl(details) {
    const destination = clean(details?.getAttribute("destination") || "");
    if (!destination) return location.href;
    try {
      return new URL(destination, location.origin).href;
    } catch (_error) {
      return location.href;
    }
  }

  function robertHalfLocation(details) {
    const worksite = clean(details?.getAttribute("worksite") || "");
    const locationText = clean(details?.getAttribute("location") || "");
    return [robertHalfWorksiteLabel(worksite), locationText].filter(Boolean).join(", ");
  }

  function robertHalfWorksiteLabel(value) {
    return value.toLowerCase() === "remote" ? "Remote" : value;
  }

  function robertHalfWarnings({ details, title, description }) {
    return [
      ...(details ? [] : ["Robert Half selected job detail element was not found; review the snapshot before drafting."]),
      ...(title ? [] : ["Robert Half selected job title was not found; review the snapshot before drafting."]),
      ...(description ? [] : ["Robert Half job description element was not found; review the snapshot before drafting."]),
    ];
  }

  globalThis.JobApplicationExtractors.register({
    id: "roberthalf",
    matches: () => location.hostname.includes("roberthalf.com"),
    async extract() {
      const details = robertHalfSelectedDetails();
      const description = robertHalfDescription(details);
      const requirementsText = firstText(['[data-testid="job-details-requirements"]'], details || document);
      const title = clean(details?.getAttribute("headline") || "");
      return opportunity("roberthalf", {
        source_url: robertHalfSourceUrl(details),
        title,
        company: "Robert Half",
        location: robertHalfLocation(details),
        employment_type: clean(details?.getAttribute("type") || ""),
        description,
        requirements: requirementsText ? [requirementsText] : [],
        skills: [],
        extraction_warnings: robertHalfWarnings({ details, title, description }),
      });
    },
  });
})();
