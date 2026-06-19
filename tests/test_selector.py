from __future__ import annotations

from upwork_proposal_assistant.models import ContextBundle, ContextProject, DraftRequest, OfferAngle, UpworkProject
from upwork_proposal_assistant.selector import select_context


def test_select_context_prefers_ai_workflow_and_matching_project() -> None:
    bundle = ContextBundle(
        profile="Profile",
        offers=[
            OfferAngle(key="mvp_launch", label="MVP", use_when=["mvp"], promise="Launch", source_ref="offer.mvp"),
            OfferAngle(
                key="ai_workflow_system",
                label="AI workflow",
                use_when=["playwright", "openai", "automation"],
                promise="Auditable AI",
                source_ref="offer.ai",
            ),
        ],
        projects=[
            ContextProject(
                slug="site",
                title="Website",
                track="launch_site",
                proof_type="client",
                service="Site",
                technologies=["WordPress"],
                best_for=["website"],
                claim="Built a website.",
            ),
            ContextProject(
                slug="apartment-finder",
                title="Apartment Finder",
                track="ai_systems",
                proof_type="experiment",
                service="AI Prototype",
                technologies=["Playwright", "OpenAI"],
                best_for=["automation", "audit trail"],
                claim="Built an auditable listing triage workflow.",
            ),
        ],
    )
    request = DraftRequest(
        project=UpworkProject(
            title="Need Playwright automation",
            description="Use OpenAI to review scraped listing evidence.",
            skills=["Playwright", "OpenAI"],
        )
    )

    selection = select_context(bundle, request)

    assert selection.angle.key == "ai_workflow_system"
    assert selection.projects[0].slug == "apartment-finder"
    assert selection.selection_decisions[0].caused_by
