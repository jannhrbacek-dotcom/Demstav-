"""Photo OCR never guesses unreadable values or writes records."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from ocr_parse import extract_fields


def fields(text):
    return {item["key"]: item["value"] for item in extract_fields(text)}


def test_diary_labeled_values():
    found = fields("""Datum: 28.10.2026
Stroj: L566/3
Pracoviště: Struskárna
Provedená práce: Třídění strusky
MTH začátek: 14000,5
MTH konec: 14004,0
Směna od: 06:00
Směna do: 15:00""")
    assert found == {
        "date": "2026-10-28", "machine": "L566/3",
        "site": "Struskárna", "work": "Třídění strusky",
        "mthStart": "14000.5", "mthEnd": "14004.0",
        "start": "06:00", "end": "15:00",
    }


def test_unlabeled_numbers_never_turn_into_mth_or_shift():
    found = fields("Číslo lístku: 14000\nVáha 15320 kg\nČas příjezdu 06:00")
    assert not any(k in found for k in ("mthStart", "mthEnd", "start", "end"))


def test_invalid_date_not_imported():
    found = fields("Datum: 31.02.2026\nMTH začátek: XX\nMTH konec: 14100")
    assert "date" not in found
    assert "mthStart" not in found
    assert found["mthEnd"] == "14100"
