from __future__ import annotations

from job_application_draft_assistant.applications.dashboard import (
    filter_application_records,
    render_application_dashboard,
    sort_application_records,
)
from job_application_draft_assistant.models import ApplicationDetectedBy, ApplicationRecord, OpportunitySnapshot


def test_filter_application_records_searches_core_fields() -> None:
    dice = application_record(source="dice", title="Software Engineer", company="SkyBridge Resources", location="Remote")
    indeed = application_record(source="indeed", title="Backend Developer", company="Acme", location="New York")

    assert filter_application_records([dice, indeed], query="skybridge") == [dice]
    assert filter_application_records([dice, indeed], source="indeed") == [indeed]
    assert filter_application_records([dice, indeed], query="remote", source="dice") == [dice]


def test_sort_application_records_sorts_before_display_limit() -> None:
    dice = application_record(source="dice", title="Software Engineer", company="SkyBridge Resources", location="Remote")
    indeed = application_record(source="indeed", title="Backend Developer", company="Acme", location="New York")

    assert sort_application_records([dice, indeed], sort="company", direction="asc") == [indeed, dice]
    assert sort_application_records([dice, indeed], sort="role", direction="desc") == [dice, indeed]


def test_render_application_dashboard_escapes_application_fields() -> None:
    record = application_record(
        source="dice",
        title="<script>alert(1)</script>",
        company="Acme & Sons",
        location="Remote",
    )

    html = render_application_dashboard(records=[record], all_records=[record], query="<script>", source="dice", limit=50)

    assert "Application Ledger" in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "Acme &amp; Sons" in html
    assert '<script>alert(1)</script>' not in html
    assert "/applications?limit=50&amp;source=dice" in html
    assert "Detected By" not in html
    assert "sort=company" in html


def test_render_application_dashboard_hides_imported_application_time() -> None:
    record = application_record(
        source="linkedin",
        title="Imported Role",
        company="Acme",
        location="Remote",
        detected_by="csv_import",
    )

    html = render_application_dashboard(records=[record], all_records=[record], limit=50)

    assert "2026-06-19" in html
    assert "2026-06-19 12:00" not in html


def test_render_application_dashboard_links_draft_by_source_url_fallback() -> None:
    record = application_record(
        source="dice",
        title="Software Engineer",
        company="Sonitalent LLC",
        location="Remote",
    )

    html = render_application_dashboard(
        records=[record],
        all_records=[record],
        draft_ids_by_source_url={record.normalized_source_url: "draft-123"},
    )

    assert 'href="/drafts/draft-123"' in html
    assert "No draft" not in html


def application_record(
    *,
    source: str,
    title: str,
    company: str,
    location: str,
    detected_by: ApplicationDetectedBy = "manual",
) -> ApplicationRecord:
    opportunity = OpportunitySnapshot(
        source=source,
        source_url=f"https://example.com/{source}/{title.replace(' ', '-').lower()}",
        title=title,
        company=company,
        location=location,
    )
    return ApplicationRecord(
        id=f"{source}-1",
        status="applied",
        applied_at="2026-06-19T12:00:00+00:00",
        source=source,
        source_url=opportunity.source_url,
        normalized_source_url=opportunity.source_url,
        title=title,
        company=company,
        location=location,
        draft_id="",
        draft_job_id="",
        opportunity=opportunity,
        detected_by=detected_by,
        warnings=[],
        created_at="2026-06-19T12:00:00+00:00",
        updated_at="2026-06-19T12:00:00+00:00",
    )
