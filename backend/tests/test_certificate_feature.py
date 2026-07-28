"""
Focused tests for the Training-Workbook Certificate feature.

Endpoints under test
--------------------
- GET  /api/training-workbook/certificate/{module_id}
- GET  /api/training-workbook/{module_id}/{lesson_id}         (certificate block)
- GET  /api/training-workbook/{module_id}/{lesson_id}/quiz    (needed to know q-count)
- POST /api/training-workbook/{module_id}/{lesson_id}/quiz/attempt

Notes on module IDs
-------------------
The review-request refers to the module as `opening-third-eye`, but the
backend `TRAINING_MODULES` list uses the id `beginner-1` (its TITLE is
"Opening Your Third Eye"). The frontend `LessonListModal` /
`LessonWorkbook` call `/certificate/${module.id}` which resolves to
`beginner-1` at runtime — so that is the id the certificate feature is
actually exercised with in-app.

To cover both the review-request phrasing AND the real end-to-end path,
the tests below exercise `beginner-1` for the happy path and additionally
document what happens for the literal `opening-third-eye` slug so any
routing/aliasing gap is visible in the report.
"""
import os
import sys

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
from conftest import BASE_URL  # noqa: E402


PSYCHIC_MODULE_ID = "beginner-1"           # actual id — title is "Opening Your Third Eye"
PSYCHIC_MODULE_TITLE = "Opening Your Third Eye"
PSYCHIC_LESSON_ID = "1"
PSYCHIC_LESSON_COUNT = 5

ASTRAL_MODULE_ID = "astral-training"
ASTRAL_LESSON_COUNT = 4
ASTRAL_LESSON_IDS = {"intro", "body-scan", "separation", "navigation"}

# The slug the review-request literally referenced. Kept only to document
# what the API returns for an unknown module id.
REQUEST_MODULE_SLUG = "opening-third-eye"


# ---------------------------------------------------------------------------
# 1. Certificate shape (fresh user, no attempts yet)
# ---------------------------------------------------------------------------
class TestCertificateInitialShape:
    """`earned=false`, correct `lessons_total`, threshold, module_title, etc."""

    def test_psychic_module_initial_shape(self, fresh_user_headers):
        r = requests.get(
            f"{BASE_URL}/api/training-workbook/certificate/{PSYCHIC_MODULE_ID}",
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["module_id"] == PSYCHIC_MODULE_ID
        assert c["module_title"] == PSYCHIC_MODULE_TITLE
        assert c["earned"] is False
        assert c["threshold_pct"] == 80
        assert c["average_pct"] == 0
        assert c["lessons_taken"] == 0
        assert c["lessons_total"] == PSYCHIC_LESSON_COUNT
        # No attempts yet ⇒ per_lesson_pct MUST be absent per implementation
        assert "per_lesson_pct" not in c, c

    def test_astral_module_initial_shape_lessons_total_4(self, fresh_user_headers):
        r = requests.get(
            f"{BASE_URL}/api/training-workbook/certificate/{ASTRAL_MODULE_ID}",
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["module_id"] == ASTRAL_MODULE_ID
        assert c["module_title"] == "Astral Travel Self-Study"
        assert c["earned"] is False
        assert c["threshold_pct"] == 80
        assert c["lessons_total"] == ASTRAL_LESSON_COUNT
        assert c["lessons_taken"] == 0
        assert c["average_pct"] == 0

    def test_unknown_module_slug_documents_behaviour(self, fresh_user_headers):
        """Documents what the endpoint returns for the review-request slug
        `opening-third-eye`. The endpoint accepts any string; unknown modules
        report `lessons_total=0` and echo the slug as the title."""
        r = requests.get(
            f"{BASE_URL}/api/training-workbook/certificate/{REQUEST_MODULE_SLUG}",
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["module_id"] == REQUEST_MODULE_SLUG
        # Signal that the slug is not a real module (lessons_total=0). Not
        # asserted as a failure because it's the intended fall-through
        # behaviour — but it means the review-request slug can't actually
        # earn a certificate.
        assert c["lessons_total"] == 0
        assert c["earned"] is False


# ---------------------------------------------------------------------------
# 2. Quiz attempt updates the certificate & populates per_lesson_pct
# ---------------------------------------------------------------------------
class TestQuizAttemptUpdatesCertificate:
    def test_submit_attempt_updates_certificate_and_per_lesson_pct(
        self, fresh_user_headers
    ):
        # Fetch quiz first (per the review-request) to learn the question count.
        qz = requests.get(
            f"{BASE_URL}/api/training-workbook/{PSYCHIC_MODULE_ID}/{PSYCHIC_LESSON_ID}/quiz",
            headers=fresh_user_headers,
            timeout=90,  # gemini generation can be slow on first hit
        )
        assert qz.status_code == 200, qz.text
        qdata = qz.json()
        questions = qdata.get("questions") or []
        assert len(questions) >= 1, f"No questions returned: {qdata}"
        q_count = len(questions)
        # No `correct_index` should leak to the client version.
        for q in questions:
            assert "correct_index" not in q

        # Submit attempt with matching answer count.
        answers = [0] * q_count
        ar = requests.post(
            f"{BASE_URL}/api/training-workbook/{PSYCHIC_MODULE_ID}/{PSYCHIC_LESSON_ID}/quiz/attempt",
            headers=fresh_user_headers,
            json={"answers": answers},
            timeout=90,
        )
        assert ar.status_code == 200, ar.text
        adata = ar.json()
        assert adata["total"] == q_count
        assert isinstance(adata["score"], int)
        assert 0 <= adata["score"] <= q_count
        assert len(adata["correct_flags"]) == q_count
        assert len(adata["correct_indices"]) == q_count
        assert len(adata["explanations"]) == q_count

        # Certificate must be attached and updated with per_lesson_pct["1"].
        cert = adata.get("certificate")
        assert cert is not None, adata
        assert cert["module_id"] == PSYCHIC_MODULE_ID
        assert cert["lessons_total"] == PSYCHIC_LESSON_COUNT
        assert cert["lessons_taken"] == 1
        assert cert["threshold_pct"] == 80
        assert "per_lesson_pct" in cert, cert
        assert PSYCHIC_LESSON_ID in cert["per_lesson_pct"], cert["per_lesson_pct"]
        expected_pct = round((adata["score"] / q_count) * 100)
        assert cert["per_lesson_pct"][PSYCHIC_LESSON_ID] == expected_pct
        # Only 1 of 5 lessons taken ⇒ cannot be earned yet.
        assert cert["earned"] is False

    def test_certificate_get_after_attempt_reflects_persistence(
        self, fresh_user_headers
    ):
        """GET /certificate/{module} must show the same lesson_pct persisted."""
        # This test relies on the previous test in the same class having
        # created an attempt. To make it robust when run in isolation, we
        # (re-)submit an attempt if needed.
        c_before = requests.get(
            f"{BASE_URL}/api/training-workbook/certificate/{PSYCHIC_MODULE_ID}",
            headers=fresh_user_headers,
            timeout=30,
        ).json()

        if c_before.get("lessons_taken", 0) == 0:
            qz = requests.get(
                f"{BASE_URL}/api/training-workbook/{PSYCHIC_MODULE_ID}/{PSYCHIC_LESSON_ID}/quiz",
                headers=fresh_user_headers,
                timeout=90,
            )
            qcount = len(qz.json()["questions"])
            requests.post(
                f"{BASE_URL}/api/training-workbook/{PSYCHIC_MODULE_ID}/{PSYCHIC_LESSON_ID}/quiz/attempt",
                headers=fresh_user_headers,
                json={"answers": [0] * qcount},
                timeout=90,
            )
            c_before = requests.get(
                f"{BASE_URL}/api/training-workbook/certificate/{PSYCHIC_MODULE_ID}",
                headers=fresh_user_headers,
                timeout=30,
            ).json()

        assert c_before["lessons_taken"] >= 1
        assert "per_lesson_pct" in c_before
        assert PSYCHIC_LESSON_ID in c_before["per_lesson_pct"]
        assert 0 <= c_before["per_lesson_pct"][PSYCHIC_LESSON_ID] <= 100


# ---------------------------------------------------------------------------
# 3. Workbook GET still returns the `certificate` block
# ---------------------------------------------------------------------------
class TestWorkbookIncludesCertificateBlock:
    def test_lesson_workbook_returns_certificate_block(self, fresh_user_headers):
        r = requests.get(
            f"{BASE_URL}/api/training-workbook/{PSYCHIC_MODULE_ID}/{PSYCHIC_LESSON_ID}",
            headers=fresh_user_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in (
            "module_id",
            "lesson_id",
            "lesson_title",
            "notes",
            "practice_log",
            "quiz",
            "quiz_generated",
            "latest_attempt",
            "certificate_threshold_pct",
            "certificate",
        ):
            assert k in data, f"Workbook missing key: {k}"
        assert data["certificate_threshold_pct"] == 80

        cert = data["certificate"]
        assert cert["module_id"] == PSYCHIC_MODULE_ID
        assert cert["lessons_total"] == PSYCHIC_LESSON_COUNT
        assert cert["threshold_pct"] == 80
        assert "earned" in cert
        assert "average_pct" in cert
        assert "lessons_taken" in cert


# ---------------------------------------------------------------------------
# 4. Auth guard – certificate endpoint must reject anonymous callers
# ---------------------------------------------------------------------------
class TestCertificateAuthGuard:
    def test_certificate_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/training-workbook/certificate/{PSYCHIC_MODULE_ID}")
        assert r.status_code in (401, 403), r.text

    def test_astral_certificate_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/training-workbook/certificate/{ASTRAL_MODULE_ID}")
        assert r.status_code in (401, 403), r.text
