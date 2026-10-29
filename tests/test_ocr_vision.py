"""No live API requests and no production writes in these tests."""
import io
import json
import sys
from pathlib import Path
from unittest.mock import Mock
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from ocr_vision import enabled, normalize_photo, parse_vision_values, recognize_with_vision
import ocr_vision


def test_disabled_without_opt_in_and_key(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "not-real")
    monkeypatch.delenv("OCR_VISION_ENABLED", raising=False)
    assert not enabled()
    with pytest.raises(RuntimeError):
        recognize_with_vision(b"invalid")


def test_no_ambiguous_mth_accepted():
    fields = parse_vision_values({
        "date": "28. 10. 2026", "machine": "L576/5",
        "mthStart": "8 440", "mthEnd": "844O",
        "start": "06:00", "end": "15:00", "work": "Nakládání strusky",
    })
    values = {item["key"]: item["value"] for item in fields}
    assert values["date"] == "2026-10-28"
    assert values["mthStart"] == "8440"
    assert "mthEnd" not in values
    assert values["start"] == "06:00"


def test_exif_stripped_and_bad_image_rejected():
    photo = io.BytesIO()
    exif = Image.Exif()
    exif[274] = 6
    Image.new("RGB", (80, 100)).save(photo, "JPEG", exif=exif)
    with Image.open(io.BytesIO(normalize_photo(photo.getvalue()))) as cleaned:
        assert cleaned.getexif().get(274) is None
    with pytest.raises(ValueError):
        normalize_photo(b"not an image")


def test_request_only_if_enabled_store_false_and_review_fields(monkeypatch):
    monkeypatch.setenv("OCR_VISION_ENABLED", "1")
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")
    photo = io.BytesIO()
    Image.new("RGB", (80, 100)).save(photo, "PNG")
    response = Mock()
    response.json.return_value = {
        "status": "completed",
        "output": [{"type": "message", "content": [{"type": "output_text", "text": json.dumps({
            "date": "2026-10-28", "machine": "L576/5", "mthStart": "8440", "mthEnd": "8446",
        })}]}],
    }
    post = Mock(return_value=response)
    monkeypatch.setattr(ocr_vision.requests, "post", post)
    fields = {f["key"]: f["value"] for f in recognize_with_vision(photo.getvalue())}
    assert fields["mthEnd"] == "8446"
    args = post.call_args
    assert args.args[0] == "https://api.openai.com/v1/responses"
    assert args.kwargs["json"]["store"] is False
    assert args.kwargs["json"]["input"][0]["content"][1]["detail"] == "original"


def test_incomplete_and_invalid_responses_rejected():
    with pytest.raises(ValueError):
        ocr_vision.response_text({"status": "incomplete", "output": []})
    with pytest.raises(ValueError):
        parse_vision_values(["wrong shape"])
