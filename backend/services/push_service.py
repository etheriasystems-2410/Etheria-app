"""
Push notification service via Expo Push API.

Tokens are stored on user documents as `push_tokens: [token1, token2, ...]` since
a user may have multiple devices. We send to all tokens for a user.
"""
import logging
from typing import List, Optional, Dict, Any
import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_to_user(db, user_id: str, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> int:
    """
    Send a push notification to all of a user's registered Expo push tokens.
    Returns the number of tokens we attempted to push to.
    Tokens that come back as invalid are pruned from the user document.
    """
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        return 0
    tokens: List[str] = user.get("push_tokens") or []
    if not tokens:
        return 0

    # Build Expo push messages
    messages = [
        {
            "to": t,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        for t in tokens
        if isinstance(t, str) and t.startswith("ExponentPushToken")
    ]
    if not messages:
        return 0

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code != 200:
                logging.error(f"[Push] Expo API {resp.status_code}: {resp.text[:200]}")
                return 0
            data_out = resp.json()

            # Prune any tokens Expo says are invalid
            tickets = data_out.get("data") or []
            invalid: List[str] = []
            for i, ticket in enumerate(tickets):
                if i >= len(messages):
                    break
                if ticket.get("status") == "error":
                    err = (ticket.get("details") or {}).get("error")
                    if err in ("DeviceNotRegistered", "InvalidCredentials"):
                        invalid.append(messages[i]["to"])
            if invalid:
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$pull": {"push_tokens": {"$in": invalid}}},
                )
                logging.info(f"[Push] Pruned {len(invalid)} invalid tokens for {user_id}")
            return len(messages)
    except Exception as e:
        logging.error(f"[Push] Send failed for {user_id}: {e}")
        return 0
