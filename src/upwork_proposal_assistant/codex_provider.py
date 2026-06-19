from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
from uuid import uuid4

from upwork_proposal_assistant.config import AppPaths


class CodexProviderError(RuntimeError):
    pass


class CodexProvider:
    def __init__(self, paths: AppPaths, timeout_seconds: int | None = None) -> None:
        self.paths = paths
        self.timeout_seconds = timeout_seconds or paths.codex_timeout_seconds

    def generate(self, prompt: str) -> dict[str, object]:
        self.paths.ensure_runtime()
        run_dir = self._prepare_run_workspace()
        output_path = run_dir / "last-message.json"
        cmd = [
            self.paths.codex_binary,
            "--ask-for-approval",
            "never",
            "exec",
            "-",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--color",
            "never",
            "-C",
            str(run_dir),
            "--output-schema",
            str(self.paths.draft_schema_path),
            "--output-last-message",
            str(output_path),
        ]
        result = subprocess.run(
            cmd,
            input=prompt,
            text=True,
            capture_output=True,
            timeout=self.timeout_seconds,
            check=False,
        )
        if result.returncode != 0:
            raise CodexProviderError(result.stderr.strip() or result.stdout.strip() or "codex exec failed")
        if not output_path.exists():
            raise CodexProviderError("codex exec did not write an output message")
        return _parse_json_message(output_path.read_text(encoding="utf-8"))

    def _prepare_run_workspace(self) -> Path:
        run_dir = self.paths.codex_runs_dir / uuid4().hex
        skills_dir = run_dir / ".agents" / "skills"
        skills_dir.mkdir(parents=True, exist_ok=True)
        target = skills_dir / "humanizer"
        if self.paths.humanizer_skill_dir.exists() and not target.exists():
            os.symlink(self.paths.humanizer_skill_dir, target, target_is_directory=True)
        return run_dir


def _parse_json_message(raw: str) -> dict[str, object]:
    text = raw.strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise CodexProviderError("codex output was not JSON") from None
        value = json.loads(text[start : end + 1])
    if not isinstance(value, dict):
        raise CodexProviderError("codex output JSON was not an object")
    return value
