(() => {
  function createDraftForm({ els, supportedDraftTypes, setApplicationControls, scheduleApplicationLookup }) {
    function listToText(values) {
      return (values || []).join("\n");
    }

    function textToList(value) {
      return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    }

    function setSourceMode(source) {
      document.body.dataset.sourceMode = String(source || "").trim().toLowerCase() === "upwork" ? "upwork" : "";
    }

    function fillOpportunity(opportunity) {
      els.source.value = opportunity.source || "";
      els.sourceUrl.value = opportunity.source_url || opportunity.url || "";
      els.title.value = opportunity.title || "";
      els.company.value = opportunity.company || "";
      els.location.value = opportunity.location || "";
      els.description.value = opportunity.description || "";
      els.skills.value = (opportunity.skills || []).join(", ");
      els.employmentType.value = opportunity.employment_type || "";
      els.companyContext.value = opportunity.company_context || "";
      els.recruiterContext.value = opportunity.recruiter_or_client_context || opportunity.client_context || "";
      els.responsibilities.value = listToText(opportunity.responsibilities);
      els.requirements.value = listToText(opportunity.requirements);
      els.niceToHaves.value = listToText(opportunity.nice_to_haves);
      els.questions.value = listToText(opportunity.application_questions);
      els.warnings.value = listToText(opportunity.extraction_warnings);
      setSourceMode(els.source.value);
      syncSourceFields();
      setApplicationControls();
      scheduleApplicationLookup(0);
      els.draftType.value = opportunity.source === "upwork" ? "upwork_proposal" : "cover_letter";
    }

    function fillRequest(request) {
      fillOpportunity(request.opportunity || request.project || {});
      if (supportedDraftTypes.has(request.draft_type)) {
        els.draftType.value = request.draft_type;
      }
      els.notes.value = request.user_notes || "";
    }

    function readRequest() {
      const skills = els.skills.value.split(",").map((skill) => skill.trim()).filter(Boolean);
      const responsibilities = textToList(els.responsibilities.value);
      const requirements = textToList(els.requirements.value);
      const niceToHaves = textToList(els.niceToHaves.value);
      const questions = textToList(els.questions.value);
      const warnings = textToList(els.warnings.value);
      const companyContext = els.companyContext.value.trim();
      const recruiterContext = els.recruiterContext.value.trim();
      const opportunity = {
        source: els.source.value.trim() || "manual",
        source_url: els.sourceUrl.value.trim(),
        captured_at: new Date().toISOString(),
        title: els.title.value.trim(),
        company: els.company.value.trim(),
        location: els.location.value.trim(),
        employment_type: els.employmentType.value.trim(),
        description: els.description.value.trim(),
        responsibilities,
        requirements,
        nice_to_haves: niceToHaves,
        skills,
        application_questions: questions,
        company_context: companyContext,
        recruiter_or_client_context: recruiterContext,
        extraction_warnings: warnings,
      };
      return {
        opportunity,
        draft_type: els.draftType.value,
        user_notes: els.notes.value.trim(),
        style: "concise",
      };
    }

    function syncSourceFields() {
      document.querySelectorAll("[data-show-when-filled]").forEach((element) => {
        const input = document.querySelector(element.dataset.showWhenFilled || "");
        element.classList.toggle("is-hidden", !input?.value.trim());
      });
    }

    return {
      fillOpportunity,
      fillRequest,
      readRequest,
      setSourceMode,
      syncSourceFields,
    };
  }

  globalThis.JobApplicationDraftForm = { create: createDraftForm };
})();
