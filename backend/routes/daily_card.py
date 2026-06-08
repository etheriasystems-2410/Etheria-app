"""
Daily Card + Streak System

One Oracle card per user per day. Same card all day; new card at midnight (user's
local-day relative to UTC). Streak counter tracks consecutive days drawn, with a
"grace day" once per 7-day window so a single missed day doesn't reset the streak.

Card selection is DETERMINISTIC per (user_id, date) — so users can re-fetch the
same card all day across devices.
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta, date
import hashlib

from .deps import db
from .auth_utils import get_current_user
from .oracle import ORACLE_CARDS

router = APIRouter(prefix="/daily", tags=["daily-card"])

GRACE_WINDOW_DAYS = 7   # how often a grace day can be used


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _date_from_iso(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def _pick_card_for(user_id: str, day_iso: str) -> dict:
    """Deterministic per-user per-day pick from ORACLE_CARDS."""
    seed = hashlib.sha256(f"{user_id}|{day_iso}".encode()).digest()
    idx = int.from_bytes(seed[:4], "big") % len(ORACLE_CARDS)
    return ORACLE_CARDS[idx]


def _pick_collective_card_for(day_iso: str) -> dict:
    """Same card for EVERY user on a given day — used for the Community
    Daily Collective Reading thread."""
    seed = hashlib.sha256(f"COLLECTIVE|{day_iso}".encode()).digest()
    idx = int.from_bytes(seed[:4], "big") % len(ORACLE_CARDS)
    return ORACLE_CARDS[idx]


def _moon_emoji_for_streak(streak: int) -> str:
    """Mystical streak indicator. Cycles through 8 lunar phases every 8 days."""
    if streak <= 0:
        return "🌑"
    phases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"]
    # Tier progression — slow growth so users feel progress
    if streak < 8:
        return phases[streak % 8]
    if streak < 30:
        return "🌕"   # full moon for week-long streaks
    if streak < 100:
        return "✨"   # sparkles for monthly+
    return "💫"        # shooting star for 100+


@router.get("/card")
async def get_daily_card(user: dict = Depends(get_current_user)):
    """Get today's daily card for the user. Same card all day. Bumps streak on
    the FIRST call of a new day; subsequent same-day calls just return the
    saved card."""
    user_id = user["user_id"]
    today_iso = _today_iso()

    # 1) Has the user already drawn today?
    existing = await db.daily_cards.find_one({"user_id": user_id, "date": today_iso})
    if existing:
        existing.pop("_id", None)
        # Return with current streak info (don't re-bump)
        streak_count = user.get("streak_count", 1)
        return {
            "card": existing["card"],
            "date": today_iso,
            "streak_count": streak_count,
            "streak_emoji": _moon_emoji_for_streak(streak_count),
            "is_new_draw": False,
        }

    # 2) First draw of the day — pick the card + update streak
    card = _pick_card_for(user_id, today_iso)
    today_d = date.fromisoformat(today_iso)
    yesterday_d = today_d - timedelta(days=1)
    day_before_d = today_d - timedelta(days=2)

    last_date = _date_from_iso(user.get("last_card_date"))
    current_streak = user.get("streak_count", 0)
    grace_used_at = _date_from_iso(user.get("streak_grace_used_at"))
    grace_available = (
        grace_used_at is None
        or (today_d - grace_used_at).days >= GRACE_WINDOW_DAYS
    )

    update_fields = {
        "last_card_date": today_iso,
    }
    grace_used_this_draw = False

    if last_date is None:
        # First ever daily card
        new_streak = 1
    elif last_date == today_d:
        # Already counted today (shouldn't happen because the daily_cards
        # lookup above caught it, but be defensive)
        new_streak = current_streak
    elif last_date == yesterday_d:
        # Consecutive day — bump
        new_streak = current_streak + 1
    elif last_date == day_before_d and grace_available:
        # 1-day gap forgiven by grace
        new_streak = current_streak + 1
        update_fields["streak_grace_used_at"] = today_iso
        grace_used_this_draw = True
    else:
        # Reset
        new_streak = 1

    update_fields["streak_count"] = new_streak
    longest = max(user.get("longest_streak", 0), new_streak)
    update_fields["longest_streak"] = longest

    await db.users.update_one({"user_id": user_id}, {"$set": update_fields})

    # 3) Save today's draw
    draw_doc = {
        "user_id": user_id,
        "date": today_iso,
        "card": card,
        "drawn_at": datetime.now(timezone.utc),
        "streak_at_draw": new_streak,
    }
    await db.daily_cards.insert_one(draw_doc)
    draw_doc.pop("_id", None)
    draw_doc.pop("drawn_at", None)  # not JSON-serializable as-is

    return {
        "card": card,
        "date": today_iso,
        "streak_count": new_streak,
        "longest_streak": longest,
        "streak_emoji": _moon_emoji_for_streak(new_streak),
        "is_new_draw": True,
        "grace_used": grace_used_this_draw,
    }


@router.get("/streak")
async def get_streak(user: dict = Depends(get_current_user)):
    today_iso = _today_iso()
    today_d = date.fromisoformat(today_iso)
    last_date = _date_from_iso(user.get("last_card_date"))

    # If the user hasn't drawn TODAY or YESTERDAY, the streak is effectively
    # at risk; we still return the stored count but flag it.
    days_since = None if last_date is None else (today_d - last_date).days
    at_risk = days_since is not None and days_since >= 1
    broken = days_since is not None and days_since > 2  # grace would already be consumed

    streak = user.get("streak_count", 0) if not broken else 0
    return {
        "streak_count": streak,
        "longest_streak": user.get("longest_streak", 0),
        "last_card_date": user.get("last_card_date"),
        "streak_emoji": _moon_emoji_for_streak(streak),
        "drew_today": last_date == today_d,
        "at_risk": at_risk,
    }


@router.get("/history")
async def get_history(limit: int = 30, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    limit = max(1, min(limit, 90))

    cursor = (
        db.daily_cards.find({"user_id": user_id})
        .sort("date", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    items = []
    for d in docs:
        d.pop("_id", None)
        d.pop("drawn_at", None)
        items.append(d)
    return {"items": items, "count": len(items)}


# ==================== COLLECTIVE DAILY READING (Community) ====================

@router.get("/collective")
async def get_collective_reading():
    """The same Oracle card for every user on a given day. Designed to power
    a pinned 'Daily Collective Reading' thread on the Community page so
    everyone can react to the same card together."""
    today_iso = _today_iso()
    card = _pick_collective_card_for(today_iso)
    return {
        "card": card,
        "date": today_iso,
        "title": f"Today's Collective Card — {card['name']}",
        "prompt": (
            f"The veil shifts today and {card['name']} steps forward for all of us. "
            f"How is this card showing up in your day? Share what stirs."
        ),
    }
