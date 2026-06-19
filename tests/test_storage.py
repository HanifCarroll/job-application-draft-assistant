from __future__ import annotations

from pathlib import Path

from upwork_proposal_assistant.models import ContextSelection, DraftRequest, OfferAngle, UpworkProject
from upwork_proposal_assistant.storage import DraftStore, make_stored_draft


def test_store_round_trips_draft_response(tmp_path: Path) -> None:
    store = DraftStore(tmp_path / "drafts.db")
    store.init()
    angle = OfferAngle(key="ai", label="AI", use_when=["ai"], promise="AI", source_ref="offer.ai")
    selection = ContextSelection(angle=angle, projects=[], source_evidence=[], selection_decisions=[])
    request = DraftRequest(project=UpworkProject(title="Job"))
    final: dict[str, object] = {
        "proposal": "I can help with this.",
        "angle": "ai",
        "selected_projects": [],
        "decisions": [],
        "claims": [],
        "warnings": [],
    }

    draft = make_stored_draft(request, selection, first_pass=final, final_pass=final)
    store.insert(draft)
    response = store.get_response(draft.id)

    assert response is not None
    assert response.proposal == "I can help with this."
