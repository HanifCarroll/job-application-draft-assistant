from __future__ import annotations

from pathlib import Path

import typer
import uvicorn

from job_application_draft_assistant.config import DEFAULT_PORTFOLIO_ROOT, AppPaths
from job_application_draft_assistant.context.indexer import build_context


app = typer.Typer(help="Local job application draft assistant.")


@app.command()
def reindex(
    portfolio_root: Path = typer.Option(
        DEFAULT_PORTFOLIO_ROOT,
        help="Portfolio or context directory used as the source.",
    ),
) -> None:
    paths = AppPaths(portfolio_root=portfolio_root)
    bundle = build_context(paths.portfolio_root, paths.context_dir)
    typer.echo(f"Indexed {len(bundle.projects)} projects into {paths.context_dir}")


@app.command()
def serve(host: str = "127.0.0.1", port: int = 8787) -> None:
    uvicorn.run("job_application_draft_assistant.api:create_app", factory=True, host=host, port=port)


if __name__ == "__main__":
    app()
