"""
Daily reminder scheduler.

Runs as a long-lived asyncio task (started from server.py at app startup) and
sends two kinds of pushes:

  • Oracle Card reminder — fires at the user's chosen morning hour (default 9
    AM local) if they haven't drawn today's card yet. Includes streak status
    in the body so users at risk feel motivated to keep their streak alive.

  • Dream Journal reminder — fires at the user's chosen morning hour (default
    7 AM local) prompting the user to log last night's dreams while still
    fresh.

The scheduler runs every 15 minutes. It treats a reminder as "due" when the
user's local hour matches their preferred hour AND the local minute is < 15
(so we don't double-send within the same hour). We mark a reminder as sent
for the day in `notification_sends` so a restart of the worker doesn't
re-trigger the same reminder.

Default preferences are merged in from `routes.notifications.DEFAULT_PREFS`
so users who never customized still get sensible reminders.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

_db = None
_task: Optional[asyncio.Task] = None
_running = False

# How often the scheduler ticks. 15 min keeps the load light while still
# hitting every "hour" preference precisely (user's chosen hour:00–hour:14).
TICK_INTERVAL_SECONDS = 15 * 60

# Defaults — keep in sync with routes/notifications.py:DEFAULT_PREFS
DEFAULTS = {
    "oracle_reminder_enabled": True,
    "oracle_reminder_hour": 9,
    "dream_reminder_enabled": True,
    "dream_reminder_hour": 7,
    "timezone_offset_minutes": 0,
}


def _today_iso_utc() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _local_hour_minute(tz_offset_minutes: int) -> tuple[int, int, str]:
    """Return (local_hour, local_minute, local_iso_date) for the given
    user timezone offset (minutes east of UTC)."""
    now_local = datetime.now(timezone.utc) + timedelta(minutes=tz_offset_minutes)
    return now_local.hour, now_local.minute, now_local.date().isoformat()


async def _already_sent(user_id: str, kind: str, day_iso: str) -> bool:
    if _db is None:
        return False
    doc = await _db.notification_sends.find_one(
        {"user_id": user_id, "kind": kind, "day": day_iso}
    )
    return bool(doc)


async def _mark_sent(user_id: str, kind: str, day_iso: str) -> None:
    if _db is None:
        return
    await _db.notification_sends.update_one(
        {"user_id": user_id, "kind": kind, "day": day_iso},
        {
            "$set": {
                "user_id": user_id,
                "kind": kind,
                "day": day_iso,
                "sent_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )


async def _send_oracle_reminder(user: dict, streak_count: int) -> None:
    from services.push_service import send_push

    user_id = user["user_id"]
    name = (user.get("display_name") or user.get("name") or "Seeker").split()[0]

    if streak_count >= 1:
        title = f"🌙 The cards are listening, {name}"
        message = (
            f"Your {streak_count}-day streak is waiting — draw today's card "
            "before midnight."
        )
    else:
        title = "✨ Today's card awaits"
        message = "The Oracle has chosen a card just for you today."

    await send_push(
        [user_id],
        {
            "title": title,
            "message": message,
            "deeplink": "/oracle",
        },
        idempotency_key=f"oracle_{user_id}_{_today_iso_utc()}",
    )


async def _send_dream_reminder(user: dict) -> None:
    from services.push_service import send_push

    user_id = user["user_id"]
    name = (user.get("display_name") or user.get("name") or "Seeker").split()[0]

    await send_push(
        [user_id],
        {
            "title": f"💭 Capture your dreams, {name}",
            "message": (
                "Dreams fade quickly. Record what you remember from last night "
                "and let your guide interpret it."
            ),
            "deeplink": "/dreams",
        },
        idempotency_key=f"dream_{user_id}_{_today_iso_utc()}",
    )


async def _tick_once() -> None:
    """One pass over all users with push registered. Sends any due reminders."""
    if _db is None:
        return

    # Only consider users who have a registered native device token (Emergent
    # only delivers if `push_registered_at` is set — see /api/register-push).
    cursor = _db.users.find(
        {"push_registered_at": {"$exists": True}},
        {
            "user_id": 1,
            "display_name": 1,
            "name": 1,
            "notification_prefs": 1,
            "streak_count": 1,
            "last_card_date": 1,
        },
    )

    oracle_count = 0
    dream_count = 0

    async for user in cursor:
        try:
            prefs = {**DEFAULTS, **(user.get("notification_prefs") or {})}
            tz_off = int(prefs.get("timezone_offset_minutes", 0))
            local_hour, local_minute, local_day = _local_hour_minute(tz_off)

            # Only fire in the first 15 min of the user's chosen local hour.
            in_window = local_minute < 15

            if not in_window:
                continue

            user_id = user["user_id"]

            # -------- Oracle reminder ----------------------------------
            if (
                prefs.get("oracle_reminder_enabled")
                and local_hour == int(prefs.get("oracle_reminder_hour", 9))
                and not await _already_sent(user_id, "oracle", local_day)
            ):
                last_card_date = user.get("last_card_date")
                # Don't pester if user already drew today
                if last_card_date != local_day:
                    streak = int(user.get("streak_count") or 0)
                    await _send_oracle_reminder(user, streak)
                    await _mark_sent(user_id, "oracle", local_day)
                    oracle_count += 1

            # -------- Dream reminder -----------------------------------
            if (
                prefs.get("dream_reminder_enabled")
                and local_hour == int(prefs.get("dream_reminder_hour", 7))
                and not await _already_sent(user_id, "dream", local_day)
            ):
                await _send_dream_reminder(user)
                await _mark_sent(user_id, "dream", local_day)
                dream_count += 1
        except Exception as e:
            logger.warning(f"[Scheduler] tick failed for user: {e}")

    if oracle_count or dream_count:
        logger.info(
            f"[Scheduler] Sent {oracle_count} oracle + {dream_count} dream reminders"
        )


async def _run_loop() -> None:
    global _running
    _running = True
    logger.info(
        f"[Scheduler] Daily reminder loop started "
        f"(tick every {TICK_INTERVAL_SECONDS}s)"
    )
    while _running:
        try:
            await _tick_once()
        except Exception as e:
            logger.error(f"[Scheduler] tick crashed: {e}")
        await asyncio.sleep(TICK_INTERVAL_SECONDS)


def start(db) -> None:
    """Start the scheduler in the background. Idempotent."""
    global _db, _task
    _db = db
    if _task and not _task.done():
        return
    _task = asyncio.create_task(_run_loop())


def stop() -> None:
    global _running, _task
    _running = False
    if _task and not _task.done():
        _task.cancel()
        _task = None
    logger.info("[Scheduler] Stopped")
