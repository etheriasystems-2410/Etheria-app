"""
Training Workbook — per-lesson notes, practice log, and quizzes.

One workbook exists per (user, module, lesson) so users can:
  • take free-form notes on the lesson
  • log real-life practice attempts / observations
  • take a 5-question quiz on the lesson content
  • earn a certificate for a module when their average quiz score
    across the module's lessons is at or above 80%.

Quizzes are generated ONCE per (module, lesson) via gemini-2.5-flash and
cached in Mongo so subsequent students share the same questions.

Collections
-----------
training_notes           per (user_id, module_id, lesson_id)
training_quizzes         per (module_id, lesson_id)  – shared
training_quiz_attempts   per (user_id, module_id, lesson_id) – latest only
"""
from __future__ import annotations

import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

# Make /app/backend importable so we can pull the training content module.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from data.training_content import LESSON_CONTENT, TRAINING_MODULES  # noqa: E402
from routes.auth import get_current_user  # noqa: E402
from routes.deps import db, EMERGENT_LLM_KEY  # noqa: E402


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/training-workbook", tags=["training-workbook"])


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CERTIFICATE_THRESHOLD_PCT = 80  # module avg needs to be ≥ 80% to earn cert
QUIZ_QUESTION_COUNT = 5
QUIZ_MODEL = ("gemini", "gemini-2.5-flash")

# Astral training is a static list defined in the frontend — mirror it here
# so quiz generation and certificates work for it.
_ASTRAL_MODULE_ID = "astral-training"
_ASTRAL_LEVELS = {
    "intro": {
        "id": "intro",
        "title": "Introduction to Astral Travel",
        "content": (
            "This introductory level teaches the foundational concepts of out-of-body "
            "experiences (OBE) and astral travel: what the astral body is, common "
            "myths and misconceptions, safety guidelines, and how relaxation and "
            "intention set the stage for successful projection. Beginners learn that "
            "astral travel is a natural extension of consciousness and requires "
            "patience, practice, and a calm nervous system."
        ),
    },
    "body-scan": {
        "id": "body-scan",
        "title": "Deep Body Relaxation",
        "content": (
            "Level 2 focuses on the progressive body relaxation and the 'vibrational "
            "state' — the buzzing, tingling sensation that precedes separation. "
            "Students learn how to systematically relax every muscle group, how to "
            "stay mentally awake while the body falls asleep (the mind-awake-body-asleep "
            "state), and how to recognise and welcome the vibrations without fear."
        ),
    },
    "separation": {
        "id": "separation",
        "title": "Consciousness Separation",
        "content": (
            "This intermediate level covers techniques to consciously separate from the "
            "physical form: the rope method, the roll-out method, and lifting a phantom "
            "limb. Students learn how to stabilise the astral body after separation, "
            "avoid the fear-based snap-back, and remain aware while in the immediate "
            "astral environment."
        ),
    },
    "navigation": {
        "id": "navigation",
        "title": "Astral Navigation",
        "content": (
            "The advanced level teaches how to move with control in the astral realm: "
            "intention-based movement, thought-directed flight, encountering astral "
            "guides and other conscious beings, safely returning to the body, and "
            "integrating astral experiences into waking life. This level emphasises "
            "discernment, protection, and post-session journaling."
        ),
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _find_lesson(module_id: str, lesson_id: str) -> Optional[dict]:
    """Return a lesson dict with `title` and `content` for either a psychic
    training lesson or an astral level."""
    if module_id == _ASTRAL_MODULE_ID:
        return _ASTRAL_LEVELS.get(lesson_id)

    lessons = LESSON_CONTENT.get(module_id) or []
    for l in lessons:
        if str(l.get("id")) == str(lesson_id):
            return {
                "id": str(l.get("id")),
                "title": l.get("title", f"Lesson {lesson_id}"),
                "content": l.get("content", ""),
                "meditation_script": (l.get("meditation") or {}).get("script", ""),
            }
    return None


def _module_lesson_ids(module_id: str) -> List[str]:
    """All lesson_ids that belong to a module. Used to compute certificates."""
    if module_id == _ASTRAL_MODULE_ID:
        return list(_ASTRAL_LEVELS.keys())
    lessons = LESSON_CONTENT.get(module_id) or []
    return [str(l["id"]) for l in lessons]


def _module_title(module_id: str) -> str:
    if module_id == _ASTRAL_MODULE_ID:
        return "Astral Travel Self-Study"
    for m in TRAINING_MODULES:
        if m["id"] == module_id:
            return m["title"]
    return module_id


def _notes_key(user_id: str, module_id: str, lesson_id: str) -> str:
    return f"{user_id}:{module_id}:{lesson_id}"


def _quiz_key(module_id: str, lesson_id: str) -> str:
    return f"{module_id}:{lesson_id}"


# ---------------------------------------------------------------------------
# Quiz generation
# ---------------------------------------------------------------------------
async def _generate_quiz(lesson: dict) -> dict:
    """Generate a 5-question multiple-choice quiz for the given lesson.
    Returns a dict {questions: [{q, options[4], correct_index, explanation}]}."""
    title = lesson.get("title", "Lesson")
    content = (lesson.get("content") or "").strip()
    if lesson.get("meditation_script"):
        content += "\n\n" + lesson["meditation_script"]

    prompt = (
        f"Lesson title: {title}\n\n"
        f"Lesson content:\n{content}\n\n"
        "Write exactly 5 multiple-choice questions that test whether the "
        "student understood THIS specific lesson. Each question has EXACTLY "
        "4 options and exactly one correct answer. Provide a one-sentence "
        "explanation for the correct answer. Return ONLY valid JSON with the "
        "following shape and no prose around it:\n"
        '{"questions": ['
        '{"q": "string", "options": ["a","b","c","d"], '
        '"correct_index": 0, "explanation": "string"}'
        ', ...]}\n'
        "Rules:\n"
        "• questions must be answerable from the lesson content alone.\n"
        "• correct_index is 0-based (0-3).\n"
        "• options must be short (< 90 chars), plausible, and distinct.\n"
        "• do not use markdown, code fences, headings, or emojis."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"training-quiz-{lesson.get('id','x')}",
        system_message=(
            "You are a rigorous curriculum designer writing multiple-choice "
            "quiz questions. Return ONLY valid JSON — no markdown, no "
            "commentary, no code fences."
        ),
    ).with_model(*QUIZ_MODEL)

    raw = await chat.send_message(UserMessage(text=prompt))

    # Strip common wrappers the model sometimes still adds.
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).rstrip("`").strip()
    # Extract the outermost JSON object if extra prose leaked in.
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if not m:
        raise ValueError("Model did not return JSON")

    data = json.loads(m.group(0))
    questions = data.get("questions") or []
    if not questions or len(questions) < 3:
        raise ValueError("Model returned too few questions")

    # Normalise: trim to QUIZ_QUESTION_COUNT and validate each entry.
    normalised = []
    for q in questions[:QUIZ_QUESTION_COUNT]:
        text = (q.get("q") or "").strip()
        options = q.get("options") or []
        correct = q.get("correct_index")
        if (
            not text
            or not isinstance(options, list)
            or len(options) != 4
            or not isinstance(correct, int)
            or not (0 <= correct <= 3)
        ):
            continue
        normalised.append(
            {
                "q": text,
                "options": [str(o).strip() for o in options],
                "correct_index": correct,
                "explanation": (q.get("explanation") or "").strip(),
            }
        )
    if not normalised:
        raise ValueError("No valid questions after normalisation")
    return {"questions": normalised}


async def _get_or_create_quiz(module_id: str, lesson_id: str) -> dict:
    """Return the cached quiz for a lesson or generate + persist a new one."""
    lesson = _find_lesson(module_id, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Unknown lesson")

    key = _quiz_key(module_id, lesson_id)
    cached = await db.training_quizzes.find_one({"_id": key})
    if cached and cached.get("questions"):
        return cached

    try:
        generated = await _generate_quiz(lesson)
    except Exception as e:
        logger.error("[training-workbook] quiz gen failed for %s: %s", key, e)
        raise HTTPException(
            status_code=502,
            detail="Quiz generation is temporarily unavailable. Please try again.",
        )

    doc = {
        "_id": key,
        "module_id": module_id,
        "lesson_id": lesson_id,
        "questions": generated["questions"],
        "generated_at": datetime.utcnow().isoformat(),
        "model": ":".join(QUIZ_MODEL),
    }
    await db.training_quizzes.replace_one({"_id": key}, doc, upsert=True)
    return doc


def _public_quiz(quiz_doc: dict) -> dict:
    """Version of the quiz safe to send to the client (no correct_index)."""
    return {
        "module_id": quiz_doc["module_id"],
        "lesson_id": quiz_doc["lesson_id"],
        "questions": [
            {"q": q["q"], "options": q["options"]} for q in quiz_doc["questions"]
        ],
    }


# ---------------------------------------------------------------------------
# Certificate computation
# ---------------------------------------------------------------------------
async def _certificate_status(user_id: str, module_id: str) -> dict:
    lesson_ids = _module_lesson_ids(module_id)
    total_lessons = len(lesson_ids)
    if total_lessons == 0:
        return {
            "module_id": module_id,
            "module_title": _module_title(module_id),
            "earned": False,
            "threshold_pct": CERTIFICATE_THRESHOLD_PCT,
            "average_pct": 0,
            "lessons_taken": 0,
            "lessons_total": 0,
        }

    attempts = await db.training_quiz_attempts.find(
        {
            "user_id": user_id,
            "module_id": module_id,
            "lesson_id": {"$in": lesson_ids},
        }
    ).to_list(1000)

    if not attempts:
        return {
            "module_id": module_id,
            "module_title": _module_title(module_id),
            "earned": False,
            "threshold_pct": CERTIFICATE_THRESHOLD_PCT,
            "average_pct": 0,
            "lessons_taken": 0,
            "lessons_total": total_lessons,
        }

    # Average percentage of BEST attempt per lesson
    best_per_lesson: dict = {}
    for a in attempts:
        pct = round((a["score"] / max(1, a["total"])) * 100)
        prev = best_per_lesson.get(a["lesson_id"])
        if prev is None or pct > prev:
            best_per_lesson[a["lesson_id"]] = pct

    lessons_taken = len(best_per_lesson)
    average_pct = round(sum(best_per_lesson.values()) / max(1, lessons_taken))
    earned = (
        lessons_taken == total_lessons
        and average_pct >= CERTIFICATE_THRESHOLD_PCT
    )
    return {
        "module_id": module_id,
        "module_title": _module_title(module_id),
        "earned": earned,
        "threshold_pct": CERTIFICATE_THRESHOLD_PCT,
        "average_pct": average_pct,
        "lessons_taken": lessons_taken,
        "lessons_total": total_lessons,
        "per_lesson_pct": best_per_lesson,
    }


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class NotesBody(BaseModel):
    notes: str = Field("", max_length=20_000)


class PracticeEntryBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=4_000)


class QuizAttemptBody(BaseModel):
    answers: List[int]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/certificate/{module_id}")
async def get_certificate(
    module_id: str,
    user: dict = Depends(get_current_user),
):
    """Certificate status for a module. Declared BEFORE the catch-all
    `/{module_id}/{lesson_id}` route so it is not shadowed."""
    return await _certificate_status(user["user_id"], module_id)


@router.get("/{module_id}/{lesson_id}")
async def get_workbook(
    module_id: str,
    lesson_id: str,
    user: dict = Depends(get_current_user),
):
    """One-call fetch of everything the workbook UI needs."""
    lesson = _find_lesson(module_id, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Unknown lesson")

    notes_doc = await db.training_notes.find_one(
        {"_id": _notes_key(user["user_id"], module_id, lesson_id)}
    )
    quiz_doc = await db.training_quizzes.find_one(
        {"_id": _quiz_key(module_id, lesson_id)}
    )
    attempt = await db.training_quiz_attempts.find_one(
        {
            "user_id": user["user_id"],
            "module_id": module_id,
            "lesson_id": lesson_id,
        }
    )

    return {
        "module_id": module_id,
        "lesson_id": lesson_id,
        "lesson_title": lesson.get("title"),
        "notes": (notes_doc or {}).get("notes", ""),
        "practice_log": (notes_doc or {}).get("practice_log", []),
        "quiz": _public_quiz(quiz_doc) if quiz_doc else None,
        "quiz_generated": bool(quiz_doc),
        "latest_attempt": {
            "score": attempt["score"],
            "total": attempt["total"],
            "answers": attempt.get("answers", []),
            "attempted_at": attempt.get("attempted_at"),
        }
        if attempt
        else None,
        "certificate_threshold_pct": CERTIFICATE_THRESHOLD_PCT,
        "certificate": await _certificate_status(user["user_id"], module_id),
    }


@router.put("/{module_id}/{lesson_id}/notes")
async def save_notes(
    module_id: str,
    lesson_id: str,
    body: NotesBody,
    user: dict = Depends(get_current_user),
):
    if not _find_lesson(module_id, lesson_id):
        raise HTTPException(status_code=404, detail="Unknown lesson")

    key = _notes_key(user["user_id"], module_id, lesson_id)
    now = datetime.utcnow().isoformat()
    await db.training_notes.update_one(
        {"_id": key},
        {
            "$set": {
                "user_id": user["user_id"],
                "module_id": module_id,
                "lesson_id": lesson_id,
                "notes": body.notes or "",
                "updated_at": now,
            },
            "$setOnInsert": {"practice_log": [], "created_at": now},
        },
        upsert=True,
    )
    return {"success": True, "updated_at": now}


@router.post("/{module_id}/{lesson_id}/practice")
async def add_practice_entry(
    module_id: str,
    lesson_id: str,
    body: PracticeEntryBody,
    user: dict = Depends(get_current_user),
):
    if not _find_lesson(module_id, lesson_id):
        raise HTTPException(status_code=404, detail="Unknown lesson")

    key = _notes_key(user["user_id"], module_id, lesson_id)
    now = datetime.utcnow().isoformat()
    entry = {"text": body.text.strip(), "at": now}
    await db.training_notes.update_one(
        {"_id": key},
        {
            "$set": {
                "user_id": user["user_id"],
                "module_id": module_id,
                "lesson_id": lesson_id,
                "updated_at": now,
            },
            "$setOnInsert": {"notes": "", "created_at": now},
            "$push": {"practice_log": entry},
        },
        upsert=True,
    )
    return {"success": True, "entry": entry}


@router.delete("/{module_id}/{lesson_id}/practice/{index}")
async def delete_practice_entry(
    module_id: str,
    lesson_id: str,
    index: int,
    user: dict = Depends(get_current_user),
):
    key = _notes_key(user["user_id"], module_id, lesson_id)
    doc = await db.training_notes.find_one({"_id": key})
    if not doc:
        raise HTTPException(status_code=404, detail="No workbook to delete from")
    log = doc.get("practice_log", []) or []
    if index < 0 or index >= len(log):
        raise HTTPException(status_code=404, detail="Practice entry not found")
    log.pop(index)
    await db.training_notes.update_one(
        {"_id": key},
        {"$set": {"practice_log": log, "updated_at": datetime.utcnow().isoformat()}},
    )
    return {"success": True}


@router.get("/{module_id}/{lesson_id}/quiz")
async def get_quiz(
    module_id: str,
    lesson_id: str,
    user: dict = Depends(get_current_user),  # auth required, user unused here
):
    """Return the cached quiz for a lesson, generating on first hit."""
    _ = user  # ensures endpoint is auth-gated
    quiz = await _get_or_create_quiz(module_id, lesson_id)
    return _public_quiz(quiz)


@router.post("/{module_id}/{lesson_id}/quiz/attempt")
async def submit_quiz_attempt(
    module_id: str,
    lesson_id: str,
    body: QuizAttemptBody,
    user: dict = Depends(get_current_user),
):
    quiz = await _get_or_create_quiz(module_id, lesson_id)
    questions = quiz["questions"]

    if len(body.answers) != len(questions):
        raise HTTPException(
            status_code=400,
            detail=f"Expected {len(questions)} answers, got {len(body.answers)}",
        )

    correct_flags = []
    explanations = []
    correct_indices = []
    for q, ans in zip(questions, body.answers):
        is_correct = int(ans) == int(q["correct_index"])
        correct_flags.append(is_correct)
        explanations.append(q.get("explanation", ""))
        correct_indices.append(q["correct_index"])

    score = sum(1 for f in correct_flags if f)
    total = len(questions)
    now = datetime.utcnow().isoformat()

    await db.training_quiz_attempts.replace_one(
        {
            "user_id": user["user_id"],
            "module_id": module_id,
            "lesson_id": lesson_id,
        },
        {
            "user_id": user["user_id"],
            "module_id": module_id,
            "lesson_id": lesson_id,
            "score": score,
            "total": total,
            "answers": [int(a) for a in body.answers],
            "attempted_at": now,
        },
        upsert=True,
    )

    return {
        "score": score,
        "total": total,
        "correct_flags": correct_flags,
        "correct_indices": correct_indices,
        "explanations": explanations,
        "attempted_at": now,
        "certificate": await _certificate_status(user["user_id"], module_id),
    }




