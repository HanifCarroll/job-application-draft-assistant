(() => {
  function currentPdf(currentState, draftId) {
    const pdf = currentState?.pdf;
    if (!pdf || pdf.draft_id !== draftId) return null;
    return pdf;
  }

  function canGeneratePdf(draftId, draftType) {
    return Boolean(draftId) && draftType === "cover_letter";
  }

  function setPdfControls({ els, currentState, pdf, canExport }) {
    const pdfStatus = currentState?.pdf_status || "";
    const isGenerating = pdfStatus === "generating";
    els.generatePdf.disabled = !canExport || isGenerating;
    els.openPdfFolder.disabled = !canExport || isGenerating || !pdf;
    if (isGenerating) {
      els.pdfStatus.textContent = "Generating PDF...";
    } else if (pdfStatus === "failed") {
      els.pdfStatus.textContent = currentState?.pdf_error ? `PDF failed: ${currentState.pdf_error}` : "PDF failed.";
    } else {
      els.pdfStatus.textContent = pdf?.filename ? `PDF: ${pdf.filename}` : "";
    }
  }

  async function startPdfExport(draftId) {
    const response = await chrome.runtime.sendMessage({ type: "START_PDF_EXPORT", draft_id: draftId });
    if (!response?.ok) throw new Error(response?.error || "Could not generate PDF.");
    return response.state;
  }

  async function revealPdf({ draftId, backendUrl, responseErrorMessage }) {
    const apiBase = await backendUrl();
    const response = await fetch(`${apiBase}/drafts/${encodeURIComponent(draftId)}/pdf/reveal`, { method: "POST" });
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response));
    }
    return response.json();
  }

  globalThis.JobApplicationPdfControls = {
    canGeneratePdf,
    currentPdf,
    revealPdf,
    setPdfControls,
    startPdfExport,
  };
})();
