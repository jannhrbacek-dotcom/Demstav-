"""Přepis hlasových poznámek (Emergent managed OpenAI Whisper, model whisper-1)."""
import io
import logging
import os
import time
from collections import defaultdict, deque

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from core import db, get_ready_user

load_dotenv()
log = logging.getLogger("stt")
router = APIRouter()

MAX_BYTES = 25 * 1024 * 1024
EXT = {"audio/webm": "webm", "video/webm": "webm", "audio/mp4": "m4a", "video/mp4": "mp4", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
       "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/ogg": "ogg"}
VOCAB = ("Provozní deník stroje, šichtovnice, motohodiny, MTH, kolový nakladač Liebherr, bagr, dozer, struska, struskový odval, "
         "nakládka, třídění, přejezd, prostoj, hydraulika, olej, AdBlue, nafta, mazání, filtr, závada, servis, objednatel, zakázka.")
_calls = defaultdict(deque)
LIMIT_PER_HOUR = 120


def _rate_limit(uid: str):
    q = _calls[uid]
    now = time.time()
    while q and now - q[0] > 3600:
        q.popleft()
    if len(q) >= LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail="Příliš mnoho přepisů za hodinu. Zkuste to prosím později.")
    q.append(now)


@router.post("/stt")
async def transcribe(file: UploadFile = File(...), field: str = Form(""), user: dict = Depends(get_ready_user)):
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Přepis řeči není nastaven.")
    data = await file.read()
    if not data or len(data) < 500:
        raise HTTPException(status_code=400, detail="Nahrávka je prázdná nebo příliš krátká.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Nahrávka je delší, než je povoleno (max. 25 MB).")
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    ext = EXT.get(ctype) or (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("webm", "m4a", "mp4", "mp3", "wav", "mpeg", "mpga", "ogg"):
        raise HTTPException(status_code=415, detail="Nepodporovaný formát nahrávky.")
    _rate_limit(user["id"])
    from emergentintegrations.llm.openai import OpenAISpeechToText
    labels = [m["label"] for m in await db.machines.find({"active": {"$ne": False}}, {"_id": 0, "label": 1}).to_list(50)]
    places = [w["name"] for w in await db.workplaces.find({"active": {"$ne": False}}, {"_id": 0, "name": 1}).to_list(50)]
    prompt = (VOCAB + " " + ", ".join(labels + places))[:900]
    buf = io.BytesIO(data)
    buf.name = f"poznamka.{ext}"
    try:
        stt = OpenAISpeechToText(api_key=key)
        resp = await stt.transcribe(file=buf, model="whisper-1", response_format="json", language="cs", prompt=prompt, temperature=0.0)
    except Exception as e:  # noqa: BLE001
        log.warning("STT failed for %s: %s", user["id"], e)
        raise HTTPException(status_code=502, detail="Přepis se nepodařil. Zkuste to prosím znovu.")
    text = (getattr(resp, "text", None) or (resp.get("text") if isinstance(resp, dict) else "") or "").strip()
    return {"text": text, "model": "whisper-1"}
