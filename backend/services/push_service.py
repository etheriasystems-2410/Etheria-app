"""
Push notification service — Emergent-managed (SuprSend relay).

This module exposes two surfaces:

1.  Low-level Emergent relay (`send_push`) — matches the playbook contract.
    Takes a list of `recipients` (= our internal user_id strings) and a
    `data` dict ({title, message, ...}). The relay resolves device tokens
    server-side, so we never store tokens in our own DB.

2.  Legacy convenience wrapper (`send_push_to_user`) — kept for the rest
    of the codebase (DM push, /api/notifications/test) so we don't have to
    touch every call-site. Internally delegates to `send_push`.

Required env var:
  EMERGENT_PUSH_KEY  — set to "placeholder" locally; deployer replaces it.
"""
import os
import logging
from typing import List, Optional, Dict, Any

import httpx

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

# Shared async HTTP client — reused across calls.
_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)


async def register_device(user_id: str, platform: str, device_token: str) -> bool:
    """Register a native device token with Emergent for the given user.

    Called by the /api/register-push endpoint after the frontend obtains a
    native FCM/APNs token via `getDevicePushTokenAsync()`.
    Returns True on success, False otherwise (never raises — callers can
    decide whether to surface the failure)."""
    if not user_id or not device_token:
        return False
    try:
        resp = await _client.post(
            "/api/v1/push/users/register",
            json={
                "user_id": user_id,
                "platform": platform or "android",
                "device_token": device_token,
            },
        )
        if resp.status_code == 401:
            logging.error("[Push] EMERGENT_PUSH_KEY missing or invalid")
            return False
        if resp.status_code >= 500:
            logging.error(f"[Push] Provider 5xx during register: {resp.status_code}")
            return False
        resp.raise_for_status()
        return True
    except Exception as e:
        logging.warning(f"[Push] register_device failed for {user_id}: {e}")
        return False


async def send_push(
    recipients: List[str],
    data: Dict[str, Any],
    idempotency_key: Optional[str] = None,
) -> bool:
    """Send a push to a list of user IDs via the Emergent relay.

    `data` MUST include `title` and `message`. Optional keys:
      - subtext (Android only)
      - image_url (HTTPS only)
      - action_url / deeplink (for tap routing)

    Returns True on success. Wraps all failures in logging and returns False —
    push must NEVER block the primary operation that triggered it."""
    if not recipients:
        return False
    if len(recipients) > 100:
        # Chunk to stay within Emergent's per-call limit
        ok_all = True
        for i in range(0, len(recipients), 100):
            ok = await send_push(recipients[i : i + 100], data, idempotency_key)
            ok_all = ok_all and ok
        return ok_all

    if "title" not in data or "message" not in data:
        logging.error("[Push] send_push data must include title and message")
        return False

    payload: Dict[str, Any] = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key

    try:
        resp = await _client.post("/api/v1/push/trigger", json=payload)
        if resp.status_code == 401:
            logging.error("[Push] EMERGENT_PUSH_KEY missing or invalid (trigger)")
            return False
        if resp.status_code >= 500:
            logging.error(f"[Push] Provider 5xx during trigger: {resp.status_code}")
            return False
        resp.raise_for_status()
        return True
    except Exception as e:
        # Soft-fail so callers don't blow up
        logging.warning(f"[Push] send_push failed: {e}")
        return False


# ---------------------------------------------------------------------------
# Backward-compat wrapper for existing call-sites (DM push, /test endpoint).
# ---------------------------------------------------------------------------
async def send_push_to_user(
    db,
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> int:
    """Send a push to a single user via the Emergent relay.

    Signature preserved from the previous Expo-direct implementation so existing
    callers (messages.py, routes/notifications.py) keep working unchanged.
    The `db` parameter is kept for the same reason but is no longer needed
    (Emergent resolves tokens internally).
    Returns 1 on success / 0 on failure (so old `sent_to_tokens` math still
    looks reasonable in the test endpoint)."""
    payload: Dict[str, Any] = {"title": title, "message": body}
    if data:
        # Surface deeplink/action_url at top level for the tap handler
        if "deeplink" in data:
            payload["deeplink"] = data["deeplink"]
        if "action_url" in data:
            payload["action_url"] = data["action_url"]
        # Stash full custom data for the client to consume
        payload.update({k: v for k, v in data.items() if k not in payload})
    ok = await send_push([user_id], payload)
    return 1 if ok else 0
