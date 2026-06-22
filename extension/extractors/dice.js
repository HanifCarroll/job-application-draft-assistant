(() => {
  const common = globalThis.JobApplicationExtractorCommon;
  const dice = globalThis.JobApplicationDiceOpportunity;
  const { clean, firstText, htmlToText, opportunity } = common;

  globalThis.JobApplicationExtractors.register({
    id: "dice",
    matches: () => location.hostname.includes("dice.com"),
    async extract() {
      const job = dice.jobPostingJsonLd();
      const description = htmlToText(job?.description);
      const company = dice.orgName(job?.hiringOrganization) || firstText(['[data-testid="job-detail-header-card"] a']);
      await dice.waitForVisibleSkillChips();
      const skills = dice.jobSkills(job);
      const extractionWarnings = [
        ...(description ? [] : ["Dice job description was not found; review the snapshot before drafting."]),
        ...(skills.length ? [] : ["Dice skills list was not found; review the snapshot before drafting."]),
      ];
      return opportunity("dice", {
        title: clean(job?.title),
        company,
        location: dice.locationFromJsonLd(job) || firstText(['[data-testid="locationTypeBadge"]']),
        employment_type: dice.employmentTypeFromJsonLd(job),
        description,
        skills,
        company_context: dice.companyContext(company),
        extraction_warnings: extractionWarnings,
      });
    },
  });
})();
