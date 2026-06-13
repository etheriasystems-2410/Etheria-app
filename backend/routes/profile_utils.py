"""
Shared helpers for the profile / circle / direct-mail routes.

Extracted from the old monolithic routes/profiles.py so the routers can each
own their own file (profile.py / direct_mail.py / circle.py) while still
sharing the canonical public-profile shape + stats aggregator.
"""
from datetime import datetime, timezone
from typing import Optional

from .deps import db

PUBLIC_PROFILE_FIELDS = (
    "user_id", "name", "display_name", "picture", "bio", "birthday",
    "location", "favorite_guide", "psychic_interests", "created_at",
    "is_admin", "is_premium",
)


def now() -> datetime:
    return datetime.now(timezone.utc)


async def _public_profile(user_doc: dict, viewer_id: Optional[str] = None) -> dict:
    """Strip private fields and add circle/relationship metadata."""
    name = (user_doc.get("display_name") or user_doc.get("name") or "Seeker").strip()
    p = {
        "user_id": user_doc.get("user_id"),
        "name": name,
        "picture": user_doc.get("picture"),
        "bio": user_doc.get("bio") or "",
        "birthday": user_doc.get("birthday"),       # ISO date string, may be ""
        "location": user_doc.get("location") or "",
        "favorite_guide": user_doc.get("favorite_guide") or "",
        "psychic_interests": user_doc.get("psychic_interests") or [],
        # Lifestyle / personality
        "hobbies": user_doc.get("hobbies") or "",
        "favorite_things": user_doc.get("favorite_things") or "",
        "dislikes": user_doc.get("dislikes") or "",
        "other_details": user_doc.get("other_details") or "",
        # "The Path I Walk" — faith group
        "path_walked": user_doc.get("path_walked") or "",
        "in_coven": bool(user_doc.get("in_coven")),
        "coven_name": user_doc.get("coven_name") or "",
        "deities_followed": user_doc.get("deities_followed") or "",
        # Psychic talent disclosures
        "family_has_psychic_talent": bool(user_doc.get("family_has_psychic_talent")),
        "family_psychic_details": user_doc.get("family_psychic_details") or "",
        "self_has_psychic_talent": bool(user_doc.get("self_has_psychic_talent")),
        "self_psychic_details": user_doc.get("self_psychic_details") or "",
        # Story
        "why_etheria": user_doc.get("why_etheria") or "",
        # Progress visibility — default ON
        "show_progress": user_doc.get("show_progress", True),
        "created_at": user_doc.get("created_at"),
        "is_admin": bool(user_doc.get("is_admin")),
        "is_premium": bool(user_doc.get("is_premium")),
    }

    # Relationship metadata for the viewer
    if viewer_id and viewer_id != user_doc.get("user_id"):
        in_circle = await db.circle_members.find_one({
            "owner_id": viewer_id,
            "member_id": user_doc.get("user_id"),
        })
        pending_out = await db.circle_invites.find_one({
            "from_id": viewer_id,
            "to_id": user_doc.get("user_id"),
            "status": "pending",
        })
        pending_in = await db.circle_invites.find_one({
            "from_id": user_doc.get("user_id"),
            "to_id": viewer_id,
            "status": "pending",
        })
        p["circle_relationship"] = (
            "in_circle" if in_circle
            else "invite_pending_out" if pending_out
            else "invite_pending_in" if pending_in
            else "none"
        )

    # Progress stats — always for self, only when toggled ON for others
    is_self = viewer_id == user_doc.get("user_id")
    if is_self or user_doc.get("show_progress", True):
        p["stats"] = await _profile_stats(user_doc)

    return p


async def _profile_stats(user_doc: dict) -> dict:
    """Compute the Progress stats. Cheap aggregate queries."""
    uid = user_doc.get("user_id")
    if not uid:
        return {}
    daily_card_count = await db.daily_cards.count_documents({"user_id": uid})
    journal_count = await db.journal_entries.count_documents({"user_id": uid})
    completed = user_doc.get("completed_modules") or []
    modules_completed = len(completed) if isinstance(completed, list) else 0
    created = user_doc.get("created_at")
    days_as_member = 0
    if isinstance(created, datetime):
        ref = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
        days_as_member = max(0, (datetime.now(timezone.utc) - ref).days)
    elif isinstance(created, str):
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            days_as_member = max(0, (datetime.now(timezone.utc) - dt).days)
        except Exception:
            pass
    return {
        "modules_completed": modules_completed,
        "current_streak": int(user_doc.get("streak_count") or 0),
        "longest_streak": int(user_doc.get("longest_streak") or 0),
        "total_cards_drawn": daily_card_count,
        "journal_entries": journal_count,
        "days_as_member": days_as_member,
    }

