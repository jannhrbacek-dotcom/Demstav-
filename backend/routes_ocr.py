"""Authenticated, non-persistent photo OCR for user-reviewed timesheet drafts."""
import asyncio
import io
import logging
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from core import get_ready_user
from ocr_parse import extract_fields

router = APIRouter()
logger = logging.getLogger("diary-ocr")
_lock = asyncio.Semaphore(1)
_attempts = defaultdict(deque)
MAX_BYTES = 10 * 1024 * 1024
CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

def _recognize(data: bytes) -> str:
    import pytesseract
    from PIL import Image, ImageOps, ImageEnhance, UnidentifiedImageError
    Image.MAX_IMAGE_PIXELS = 24000000
    try:
        source = Image.open(io.BytesIO(data))
        source.verify()
        source = Image.open(io.BytesIO(data))
        if source.width * source.height > 24000000:
            raise ValueError("too many pixels")
        source = ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="Fotografie je poškozená nebo příliš velká.") from exc
    source.thumbnail((2300, 2300))
    gray = ImageOps.grayscale(source)
    image = ImageOps.autocontrast(ImageEnhance.Contrast(gray).enhance(1.25))
    return pytesseract.image_to_string(image, lang="ces+eng", config="--psm 6", timeout=20).strip()

@router.post("/ocr/diary")
async def diary_photo(file: UploadFile = File(...), user: dict = Depends(get_ready_user)):
    ctype = (file.content_type or "").split(";")[0].lower()
    if ctype not in CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Použijte fotografii JPG, PNG nebo WEBP.")
    bucket = _attempts[user['id']]
    now = time.monotonic()
    while bucket and now - bucket[0] > 3600:
        bucket.popleft()
    if len(bucket) >= 30:
        raise HTTPException(status_code=429, detail="Limit 30 OCR fotografií za hodinu byl vyčerpán.")
    bucket.append(now)
    raw = await file.read(MAX_BYTES + 1)
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Fotografie musí mít nejvýše 10 MB.")
    try:
        async with _lock:
            text = await asyncio.to_thread(_recognize, raw)
    except HTTPException:
        raise
    except (RuntimeError, TimeoutError) as exc:
        logger.warning("OCR timeout or failure for %s: %s", user["id"], type(exc).__name__)
        raise HTTPException(status_code=503, detail="Přepis fotografie nebyl dokončen. Zkuste kvalitnější snímek.") from exc
    except Exception as exc:
        logger.warning("OCR failed for %s: %s", user["id"], type(exc).__name__)
        raise HTTPException(status_code=503, detail="OCR právě není dostupné. Fotografie zůstává v přílohách.") from exc
    return {"text": text[:8000], "fields": extract_fields(text), "needsReview": True,
            "warning": "OCR může chybovat zejména u rukopisu, MTH a časů. Před použitím vše zkontrolujte."}
