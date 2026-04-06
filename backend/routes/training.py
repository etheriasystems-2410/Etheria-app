"""
Training modules endpoints
"""
from fastapi import APIRouter, HTTPException
from data.training_content import TRAINING_MODULES, LESSON_CONTENT

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
