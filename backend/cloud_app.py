"""Single-origin production entry point: existing API plus the built React app."""
import os
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from server import app

BUILD = Path(os.environ.get("FRONTEND_BUILD_DIR", "/app/frontend/build")).resolve()


@app.get("/api/ready")
async def ready():
    from core import db
    try:
        await db.command("ping")
    except Exception:
        raise HTTPException(status_code=503, detail="Databáze není dostupná.")
    return {"ok": True}


if (BUILD / "static").is_dir():
    app.mount("/static", StaticFiles(directory=BUILD / "static"), name="static")


@app.get("/{path:path}", include_in_schema=False)
async def frontend(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404)
    candidate = (BUILD / path).resolve()
    if not candidate.is_relative_to(BUILD):
        raise HTTPException(status_code=404)
    if not candidate.is_file():
        if Path(path).suffix:
            raise HTTPException(status_code=404)
        candidate = BUILD / "index.html"
    if not candidate.is_file():
        raise HTTPException(status_code=503, detail="Frontend není sestavený.")
    return FileResponse(candidate, headers={"Cache-Control": "no-cache"})
