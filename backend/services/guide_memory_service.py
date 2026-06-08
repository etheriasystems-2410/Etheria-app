"""
Spirit Guide Memory Service

Persists short summaries of each user's chats with each guide so the guide can
"remember" prior conversations. Memories are stored in MongoDB collection
`guide_memories` (per-user, per-guide, capped to last 5). Familiarity tiers
are derived from the total message count to a guide.

Tiers (all guides — Elemental / LGBTQ+ / Custom / Divine):
  • Stranger     0–3 msgs   — no badge shown
  • Acquaintance 4–15 msgs  — ✦
  • Confidant   16–50 msgs  — ✧
  • Soul-bonded  51+ msgs   — ★
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

MAX_MEMORIES_PER_GUIDE = 5

TIER_THRESHOLDS = [
    (0, "Stranger", ""),
    (4, "Acquaintance", "✦"),
    (16, "Confidant", "✧"),
    (51, "Soul-bonded", "★"),
]


def get_tier(message_count: int) -> Dict[str, Any]:
    """Return tier info for a given message count."""
    label, symbol = "Stranger", ""
    for threshold, t_label, t_sym in TIER_THRESHOLDS:
        if message_count >= threshold:
            label, symbol = t_label, t_sym
    return {
        "message_count": message_count,
        "tier_label": label,
        "tier_symbol": symbol,
    }


async def record_chat_exchange(
    db,
    user_id: str,
    guide_name: str,
    user_message: str,
    guide_response: str,
) -> None:
    """Append a short summary of one user↔guide exchange. Keeps only the
    most recent MAX_MEMORIES_PER_GUIDE per (user_id, guide_name).
    Also increments the per-guide message counter on the user document so
    familiarity tier can be computed cheaply at query time."""
    # Short summary kept locally — no LLM call (cost-free). The first ~120
    # chars of each side preserves topical context without bloating storage.
    summary = (
        f"User: {(user_message or '').strip()[:120]} | "
        f"Guide: {(guide_response or '').strip()[:120]}"
    )

    doc = {
        "user_id": user_id,
        "guide_name": guide_name,
        "summary": summary,
        "ts": datetime.now(timezone.utc),
    }
    await db.guide_memories.insert_one(doc)

    # Trim to last MAX_MEMORIES_PER_GUIDE
    cursor = (
        db.guide_memories.find({"user_id": user_id, "guide_name": guide_name})
        .sort("ts", -1)
        .skip(MAX_MEMORIES_PER_GUIDE)
    )
    stale = await cursor.to_list(length=100)
    if stale:
        stale_ids = [d["_id"] for d in stale]
        await db.guide_memories.delete_many({"_id": {"$in": stale_ids}})

    # Bump per-guide message counter on the user document
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {f"guide_message_counts.{guide_name}": 1}},
    )


async def load_recent_memories(
    db,
    user_id: str,
    guide_name: str,
    limit: int = MAX_MEMORIES_PER_GUIDE,
) -> List[str]:
    """Return the last `limit` summary lines for this user+guide, OLDEST FIRST
    so they read chronologically in the system prompt."""
    cursor = (
        db.guide_memories.find(
            {"user_id": user_id, "guide_name": guide_name}, {"_id": 0, "summary": 1}
        )
        .sort("ts", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    docs.reverse()  # oldest first
    return [d["summary"] for d in docs]


def build_memory_preamble(summaries: List[str]) -> str:
    """Format the loaded memories for injection into the system prompt.
    Returns empty string if no prior memories — so the very first chat with
    a guide feels fresh, not contrived."""
    if not summaries:
        return ""
    lines = [f"- {s}" for s in summaries]
    return (
        "\n\nMEMORY OF PRIOR CONVERSATIONS WITH THIS SEEKER "
        "(briefly weave in if relevant; do NOT recite directly; never say "
        "'you said earlier' or quote verbatim — let the memory inform tone "
        "and continuity naturally):\n" + "\n".join(lines)
    )


async def get_user_familiarity_map(db, user_id: str) -> Dict[str, Dict[str, Any]]:
    """Return {guide_name: tier_info} for every guide this user has talked
    with."""
    user = await db.users.find_one({"user_id": user_id}, {"guide_message_counts": 1})
    counts: Dict[str, int] = (user or {}).get("guide_message_counts") or {}
    return {guide: get_tier(count) for guide, count in counts.items() if count > 0}
