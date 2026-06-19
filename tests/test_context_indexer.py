from __future__ import annotations

import json
from pathlib import Path

from upwork_proposal_assistant.context.indexer import build_context, load_context


def test_build_context_indexes_portfolio_projects(tmp_path: Path) -> None:
    portfolio = tmp_path / "portfolio"
    projects_dir = portfolio / "projects"
    projects_dir.mkdir(parents=True)
    (portfolio / "profile.md").write_text("# Test Profile\n\nBuilds reliable software.", encoding="utf-8")
    (portfolio / "offers.json").write_text(
        json.dumps(
            [
                {
                    "key": "reliability",
                    "label": "Reliability",
                    "use_when": ["reliable"],
                    "promise": "Make critical flows reliable.",
                    "source_ref": "offers.reliability",
                }
            ]
        ),
        encoding="utf-8",
    )
    (projects_dir / "demo.json").write_text(
        json.dumps(
            {
                "slug": "demo",
                "title": "Demo AI Workflow",
                "description": "Built an auditable AI workflow.",
                "proofType": "experiment",
                "service": "Product Engineering Prototype",
                "track": "ai_systems",
                "technologies": ["Python", "Playwright", "OpenAI"],
                "bestFor": ["browser automation"],
                "result": ["Kept evidence visible for review."],
            }
        ),
        encoding="utf-8",
    )

    bundle = build_context(portfolio, tmp_path / "context")
    loaded = load_context(tmp_path / "context")

    assert len(bundle.projects) == 1
    assert bundle.profile.startswith("# Test Profile")
    assert bundle.offers[0].key == "reliability"
    assert loaded.projects[0].slug == "demo"
    assert "ai" in loaded.projects[0].best_for
    assert "browser automation" in loaded.projects[0].best_for
