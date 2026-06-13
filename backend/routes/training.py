"""
Training modules endpoints
"""
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel

from data.training_content import TRAINING_MODULES, LESSON_CONTENT
from .deps import db
from .auth_utils import get_current_user

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/modules")
async def get_training_modules():
    """Get all training modules"""
    return TRAINING_MODULES


@router.get("/modules/{module_id}/lessons")
async def get_module_lessons(module_id: str):
    """Get lessons for a specific training module"""
    if module_id not in LESSON_CONTENT:
        raise HTTPException(status_code=404, detail="Module not found")
    return {
        "module_id": module_id,
        "lessons": LESSON_CONTENT[module_id]
    }


@router.get("/modules/{module_id}/lessons/{lesson_id}")
async def get_single_lesson(module_id: str, lesson_id: int):
    """Get a specific lesson from a module"""
    if module_id not in LESSON_CONTENT:
        raise HTTPException(status_code=404, detail="Module not found")

    lessons = LESSON_CONTENT[module_id]
    lesson = next((l for l in lessons if l["id"] == lesson_id), None)

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return lesson


# ---------------------------------------------------------------------------
# Progress tracking — powers the Profile → Progress → "Modules completed" stat
# ---------------------------------------------------------------------------
class LessonCompleteBody(BaseModel):
    module_id: str
    lesson_id: int


def _all_lessons_in_module(module_id: str) -> List[int]:
    lessons = LESSON_CONTENT.get(module_id) or []
    return [int(l.get("id")) for l in lessons if "id" in l]


@router.get("/progress")
async def get_my_training_progress(user: dict = Depends(get_current_user)):
    """Return the calling user's per-lesson and per-module completion state."""
    doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    completed_lessons = doc.get("completed_lessons") or []
    completed_modules = doc.get("completed_modules") or []
    return {
        "completed_lessons": completed_lessons,       # e.g. ["beginner-1", "beginner-2"]
        "completed_modules": completed_modules,       # e.g. ["beginner"]
        "module_count": len(completed_modules),
    }


@router.post("/lesson-complete")
async def mark_lesson_complete(body: LessonCompleteBody, user: dict = Depends(get_current_user)):
    """Mark a lesson complete for the calling user. If completing this lesson
    completes the whole module, also $addToSet the module id to
    `completed_modules` so the Profile progress stat ticks up."""
    if body.module_id not in LESSON_CONTENT:
        raise HTTPException(status_code=404, detail="Module not found")
    if not any(int(l.get("id", -1)) == int(body.lesson_id) for l in LESSON_CONTENT[body.module_id]):
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson_key = f"{body.module_id}-{body.lesson_id}"
    now = datetime.now(timezone.utc)

    # Idempotent add
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$addToSet": {"completed_lessons": lesson_key},
            "$set": {"last_lesson_completed_at": now},
        },
    )

    # Re-check completion now that this lesson is recorded
    doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    completed_lessons = set(doc.get("completed_lessons") or [])
    required = {f"{body.module_id}-{lid}" for lid in _all_lessons_in_module(body.module_id)}
    module_just_completed = bool(required) and required.issubset(completed_lessons)

    if module_just_completed:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$addToSet": {"completed_modules": body.module_id}},
        )

    # Send back the fresh counts so the frontend can update its UI
    doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    return {
        "success": True,
        "lesson_key": lesson_key,
        "module_completed": body.module_id in (doc.get("completed_modules") or []),
        "completed_lessons": doc.get("completed_lessons") or [],
        "completed_modules": doc.get("completed_modules") or [],
    }
