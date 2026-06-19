from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from upwork_proposal_assistant.codex_provider import CodexProvider
from upwork_proposal_assistant.models import ContextBundle, ContextSelection, DraftJobStage, DraftRequest, StoredDraft
from upwork_proposal_assistant.prompts import build_draft_prompt, build_humanizer_prompt
from upwork_proposal_assistant.selector import select_context
from upwork_proposal_assistant.storage import DraftStore, make_stored_draft


StageCallback = Callable[[DraftJobStage, ContextSelection | None], None]


@dataclass(frozen=True)
class DraftPipelineResult:
    stored: StoredDraft
    selection: ContextSelection


def run_draft_pipeline(
    request: DraftRequest,
    context: ContextBundle,
    codex: CodexProvider,
    store: DraftStore,
    on_stage: StageCallback | None = None,
) -> DraftPipelineResult:
    _notify(on_stage, "selecting_context", None)
    selection = select_context(context, request)

    _notify(on_stage, "codex_draft", selection)
    first_pass = codex.generate(build_draft_prompt(request, selection, context.profile))

    _notify(on_stage, "humanizer", selection)
    final_pass = codex.generate(build_humanizer_prompt(first_pass, selection))

    _notify(on_stage, "saving", selection)
    stored = make_stored_draft(request, selection, first_pass, final_pass)
    store.insert(stored)
    return DraftPipelineResult(stored=stored, selection=selection)


def _notify(callback: StageCallback | None, stage: DraftJobStage, selection: ContextSelection | None) -> None:
    if callback is not None:
        callback(stage, selection)
