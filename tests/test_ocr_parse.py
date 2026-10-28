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


def test_spaced_mth_and_czech_date_preserve_complete_values():
    found = fields("Datum: 28. 10. 2026\nMTH začátek: 8 440\nMTH konec: 8 446")
    assert found == {"date": "2026-10-28", "mthStart": "8440", "mthEnd": "8446"}
    assert float(found["mthEnd"]) - float(found["mthStart"]) == 6


def test_grouped_decimal_mth_unicode_spaces_and_explicit_unit():
    found = fields("Počáteční stav MTH: 14\u00a0000,50 MTH\nMTH konec: 14\u202f004.25")
    assert found == {"mthStart": "14000.50", "mthEnd": "14004.25"}


def test_damaged_or_ambiguous_mth_are_not_truncated():
    for value in ("8 44", "84 40", "844O", "8440?", "8440/8446", "8440 až 8446",
                  "8440,123", "1234567", "-8440", "+8440", "8.440,5", "8,440.5",
                  "1 234 567", "8440 8446", "8440 MTH konec: 8446"):
        found = fields(f"MTH začátek: {value}")
        assert "mthStart" not in found, (value, found)


def test_date_requires_complete_unambiguous_reading():
    for value in ("28. 10. 20260", "28. 10. 2026?", "28.10/2026", "28.10.2026 až 29.10.2026",
                  "29. 2. 2026", "-28.10.2026"):
        assert "date" not in fields(f"Datum: {value}"), value
    assert fields("Datum: 2026-10-28")["date"] == "2026-10-28"
    assert fields("Datum: 29. 2. 2024")["date"] == "2024-02-29"


def test_conflicting_labeled_values_require_user_review():
    for text, key in (("MTH začátek: 8440\nMTH začátek: 8441", "mthStart"),
                      ("MTH konec: 8446\nMTH konec: 844O", "mthEnd"),
                      ("Datum: 28.10.2026\nDatum: 29.10.2026", "date")):
        assert key not in fields(text)
    assert fields("MTH konec: 8 446\nMTH konec: 8446")["mthEnd"] == "8446"
