from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
import sqlite3
from uuid import uuid4

from pydantic import BaseModel

from upwork_proposal_assistant.models import (
    ContextSelection,
    DraftJobCreated,
    DraftJobStage,
    DraftJobState,
    DraftRequest,
)


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class DraftJobRecord(BaseModel):
    id: str
    status: DraftJobState
    stage: DraftJobStage
    request: DraftRequest
    selection: ContextSelection | None = None
    result_draft_id: str | None = None
    error: str | None = None
    created_at: str
    updated_at: str


class DraftJobStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def init(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                create table if not exists draft_jobs (
                    id text primary key,
                    status text not null,
                    stage text not null,
                    request_json text not null,
                    selection_json text,
                    result_draft_id text,
                    error text,
                    created_at text not null,
                    updated_at text not null
                )
                """
            )

    def create(self, request: DraftRequest) -> DraftJobCreated:
        job_id = uuid4().hex
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                insert into draft_jobs (
                    id, status, stage, request_json, selection_json, result_draft_id, error, created_at, updated_at
                )
                values (?, ?, ?, ?, null, null, null, ?, ?)
                """,
                (job_id, "queued", "queued", request.model_dump_json(), now, now),
            )
        return DraftJobCreated(id=job_id, status="queued", stage="queued", created_at=now, updated_at=now)

    def get(self, job_id: str) -> DraftJobRecord | None:
        with self._connect() as conn:
            row = conn.execute("select * from draft_jobs where id = ?", (job_id,)).fetchone()
        if row is None:
            return None
        return self._record_from_row(row)

    def update_stage(self, job_id: str, stage: DraftJobStage) -> None:
        with self._connect() as conn:
            conn.execute(
                "update draft_jobs set status = ?, stage = ?, updated_at = ? where id = ?",
                ("running", stage, utc_now_iso(), job_id),
            )

    def save_selection(self, job_id: str, selection: ContextSelection, stage: DraftJobStage) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                update draft_jobs
                set status = ?, stage = ?, selection_json = ?, updated_at = ?
                where id = ?
                """,
                ("running", stage, selection.model_dump_json(), utc_now_iso(), job_id),
            )

    def complete(self, job_id: str, draft_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                update draft_jobs
                set status = ?, stage = ?, result_draft_id = ?, error = null, updated_at = ?
                where id = ?
                """,
                ("succeeded", "done", draft_id, utc_now_iso(), job_id),
            )

    def fail(self, job_id: str, error: str) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                update draft_jobs
                set status = ?, stage = ?, error = ?, updated_at = ?
                where id = ?
                """,
                ("failed", "failed", error, utc_now_iso(), job_id),
            )

    def fail_active(self, error: str) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                update draft_jobs
                set status = ?, stage = ?, error = ?, updated_at = ?
                where status in ('queued', 'running')
                """,
                ("failed", "failed", error, utc_now_iso()),
            )

    def _record_from_row(self, row: sqlite3.Row) -> DraftJobRecord:
        selection_json = row["selection_json"]
        selection = ContextSelection.model_validate_json(str(selection_json)) if selection_json is not None else None
        return DraftJobRecord(
            id=str(row["id"]),
            status=row["status"],
            stage=row["stage"],
            request=DraftRequest.model_validate_json(str(row["request_json"])),
            selection=selection,
            result_draft_id=str(row["result_draft_id"]) if row["result_draft_id"] is not None else None,
            error=str(row["error"]) if row["error"] is not None else None,
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
