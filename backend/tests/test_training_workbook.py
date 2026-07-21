"""Tests for the Training Workbook feature (notes + practice + quiz + certificate)."""
import time

import os
import sys

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
from conftest import BASE_URL  # noqa: E402


MODULE_ID = "beginner-1"
LESSON_ID = "1"
ASTRAL_MODULE = "astral-training"
ASTRAL_LESSON = "intro"


# ---------------------------------------------------------------------------
# Priority 4 — Auth guard (no bearer token)
# ---------------------------------------------------------------------------
class TestAuthGuard:
    def test_get_workbook_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}")
        assert r.status_code in (401, 403), r.text

    def test_put_notes_requires_auth(self, api):
        r = api.put(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/notes",
            json={"notes": "x"},
        )
        assert r.status_code in (401, 403), r.text

    def test_post_practice_requires_auth(self, api):
        r = api.post(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/practice",
            json={"text": "x"},
        )
        assert r.status_code in (401, 403), r.text

    def test_get_quiz_requires_auth(self, api):
        r = api.get(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/quiz"
        )
        assert r.status_code in (401, 403), r.text

    def test_post_quiz_attempt_requires_auth(self, api):
        r = api.post(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/quiz/attempt",
            json={"answers": [0, 0, 0, 0, 0]},
        )
        assert r.status_code in (401, 403), r.text

    def test_certificate_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/training-workbook/certificate/{MODULE_ID}")
        assert r.status_code in (401, 403), r.text


# ---------------------------------------------------------------------------
# Priority 1 — Psychic training happy path (beginner-1 / lesson 1)
# ---------------------------------------------------------------------------
class TestPsychicHappyPath:
    def _cleanup(self, headers):
        """Best-effort cleanup: clear notes + drain practice log."""
        try:
            requests.put(
                f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/notes",
                json={"notes": ""},
                headers=headers,
                timeout=15,
            )
            for _ in range(20):
                r = requests.get(
                    f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}",
                    headers=headers,
                    timeout=15,
                )
                if r.status_code != 200:
                    break
                log = (r.json() or {}).get("practice_log") or []
                if not log:
                    break
                requests.delete(
                    f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/practice/0",
                    headers=headers,
                    timeout=15,
                )
        except Exception:
            pass

    def test_01_get_initial_workbook(self, fresh_user_headers):
        self._cleanup(fresh_user_headers)
        r = requests.get(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}",
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in (
            "notes",
            "practice_log",
            "quiz",
            "quiz_generated",
            "latest_attempt",
            "certificate",
        ):
            assert k in data, f"Missing key: {k}. Body: {data}"
        assert data["notes"] == ""
        assert data["practice_log"] == []
        cert = data["certificate"]
        assert cert.get("earned") is False
        assert cert.get("lessons_taken") == 0

    def test_02_put_notes_persists(self, fresh_user_headers):
        payload = {"notes": "pineal gland test"}
        r = requests.put(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/notes",
            json=payload,
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        g = requests.get(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}",
            headers=fresh_user_headers,
            timeout=30,
        )
        assert g.status_code == 200
        assert g.json().get("notes") == "pineal gland test"

    def test_03_add_practice_entry(self, fresh_user_headers):
        r = requests.post(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/practice",
            json={"text": "felt tingling at brow"},
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body["entry"]["text"] == "felt tingling at brow"
        assert body["entry"].get("at")

        g = requests.get(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}",
            headers=fresh_user_headers,
            timeout=30,
        )
        log = g.json().get("practice_log") or []
        assert any(e.get("text") == "felt tingling at brow" for e in log)

    def test_04_delete_practice_entry(self, fresh_user_headers):
        r = requests.delete(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/practice/0",
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        g = requests.get(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}",
            headers=fresh_user_headers,
            timeout=30,
        )
        log = g.json().get("practice_log") or []
        assert not any(e.get("text") == "felt tingling at brow" for e in log)

    def test_05_get_quiz_generates_and_hides_correct_index(self, fresh_user_headers):
        r = requests.get(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/quiz",
            headers=fresh_user_headers,
            timeout=90,  # gemini generation can take a while
        )
        assert r.status_code == 200, r.text
        data = r.json()
        qs = data.get("questions") or []
        assert len(qs) == 5, f"Expected 5 questions, got {len(qs)}"
        for q in qs:
            assert q.get("q"), "Empty question"
            assert isinstance(q.get("options"), list) and len(q["options"]) == 4
            assert "correct_index" not in q, "correct_index leaked to client!"
            assert "explanation" not in q, "explanation leaked to client before attempt"

    def test_06_submit_quiz_attempt(self, fresh_user_headers):
        r = requests.post(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/quiz/attempt",
            json={"answers": [0, 0, 0, 0, 0]},
            headers=fresh_user_headers,
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("score"), int)
        assert d.get("total") == 5
        assert isinstance(d.get("correct_flags"), list) and len(d["correct_flags"]) == 5
        assert isinstance(d.get("correct_indices"), list) and len(d["correct_indices"]) == 5
        assert isinstance(d.get("explanations"), list) and len(d["explanations"]) == 5
        cert = d.get("certificate") or {}
        assert "average_pct" in cert
        assert cert.get("lessons_taken", 0) >= 1

    def test_07_wrong_answer_count_returns_400(self, fresh_user_headers):
        r = requests.post(
            f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{LESSON_ID}/quiz/attempt",
            json={"answers": [0, 0, 0]},
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code} — {r.text}"


# ---------------------------------------------------------------------------
# Priority 2 — Astral training quiz flow
# ---------------------------------------------------------------------------
class TestAstralQuiz:
    def test_astral_intro_quiz_generation(self, fresh_user_headers):
        r = requests.get(
            f"{BASE_URL}/api/training-workbook/{ASTRAL_MODULE}/{ASTRAL_LESSON}/quiz",
            headers=fresh_user_headers,
            timeout=90,
        )
        assert r.status_code == 200, r.text
        qs = r.json().get("questions") or []
        assert len(qs) == 5, f"Expected 5 astral questions, got {len(qs)}"
        for q in qs:
            assert "correct_index" not in q

        # Now submit an attempt (guess all zeros) — verifies the flow completes
        r2 = requests.post(
            f"{BASE_URL}/api/training-workbook/{ASTRAL_MODULE}/{ASTRAL_LESSON}/quiz/attempt",
            json={"answers": [0, 0, 0, 0, 0]},
            headers=fresh_user_headers,
            timeout=90,
        )
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d.get("total") == 5


# ---------------------------------------------------------------------------
# Priority 3 — Certificate computation
# ---------------------------------------------------------------------------
class TestCertificateAllFiveLessons:
    def test_certificate_after_all_lessons(self, fresh_user_headers):
        for lesson_id in ["1", "2", "3", "4", "5"]:
            # Fetch quiz to make sure it exists
            r = requests.get(
                f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{lesson_id}/quiz",
                headers=fresh_user_headers,
                timeout=90,
            )
            assert r.status_code == 200, f"Quiz gen failed for lesson {lesson_id}: {r.text}"
            # Submit an attempt (may be right/wrong — doesn't matter for shape check)
            r2 = requests.post(
                f"{BASE_URL}/api/training-workbook/{MODULE_ID}/{lesson_id}/quiz/attempt",
                json={"answers": [0, 0, 0, 0, 0]},
                headers=fresh_user_headers,
                timeout=90,
            )
            assert r2.status_code == 200, r2.text

        cert = requests.get(
            f"{BASE_URL}/api/training-workbook/certificate/{MODULE_ID}",
            headers=fresh_user_headers,
            timeout=30,
        )
        assert cert.status_code == 200, cert.text
        c = cert.json()
        assert c.get("lessons_total") == 5, c
        assert c.get("lessons_taken") == 5, c
        assert c.get("threshold_pct") == 80
        assert 0 <= c.get("average_pct", -1) <= 100
        # earned is computed from the accidental score
        assert isinstance(c.get("earned"), bool)
