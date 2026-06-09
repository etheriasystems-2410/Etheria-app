"""
Subscription & payment endpoints — direct Stripe integration.

Migrated from `emergentintegrations.payments.stripe.*` shared key to the
user's own Stripe account so events show on their Stripe dashboard.

Plans:
  • Monthly  $3.99   STRIPE_PRICE_MONTHLY  (plan_id = "premium_monthly")
  • Annual   $36.99  STRIPE_PRICE_ANNUAL   (plan_id = "premium_annual")

Endpoints (all under /api):
  GET  /subscription/plans              public plan info
  GET  /subscription/status             current user premium state + features
  POST /subscription/create-checkout    create a Checkout Session, return URL
  GET  /subscription/checkout-status/{session_id}    poll after redirect
  POST /webhook/stripe                  signature-verified webhook receiver
  GET  /user/feature-access/{feature}   per-feature gate helper

Webhook events handled:
  • checkout.session.completed
  • customer.subscription.created
  • customer.subscription.updated
  • customer.subscription.deleted
  • invoice.payment_succeeded
  • invoice.payment_failed
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict

import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from .deps import db, FREE_TIER_LIMITS
from .auth_utils import get_current_user

logger = logging.getLogger(__name__)

# ---- Stripe config (from env, set in /app/backend/.env) -------------------
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
STRIPE_PRICE_MONTHLY = os.environ.get("STRIPE_PRICE_MONTHLY", "").strip()
STRIPE_PRICE_ANNUAL = os.environ.get("STRIPE_PRICE_ANNUAL", "").strip()

# Plan catalog — single source of truth used by /plans, /create-checkout
SUBSCRIPTION_PLANS = {
    "premium_monthly": {
        "name": "Etheria Premium Monthly",
        "price": 3.99,
        "currency": "usd",
        "interval": "month",
        "stripe_price_id": STRIPE_PRICE_MONTHLY,
        "features": [
            "Unlimited Oracle readings with AI",
            "Access to all Spirit Guides",
            "AI Guided Meditation",
            "Binaural & Astral Meditation",
            "Unlimited Journal entries",
            "All Training modules",
            "Companion Guide (always-on bond)",
        ],
    },
    "premium_annual": {
        "name": "Etheria Premium Annual",
        "price": 36.99,
        "currency": "usd",
        "interval": "year",
        "stripe_price_id": STRIPE_PRICE_ANNUAL,
        "savings_label": "Save 23% vs monthly",
        "features": [
            "Everything in monthly",
            "Save $10.89/year",
            "Priority email support",
        ],
    },
}

# How long premium stays active for a given interval (used as a buffer if a
# webhook is delayed; the webhook itself will set the precise period_end).
INTERVAL_TO_DAYS = {"month": 31, "year": 366}


# ===========================================================================
# Router setup
# ===========================================================================
router = APIRouter(prefix="/subscription", tags=["subscription"])
webhook_router = APIRouter(prefix="/webhook", tags=["webhook"])
user_router = APIRouter(prefix="/user", tags=["user"])


# ---- Models ---------------------------------------------------------------
class CreateCheckoutRequest(BaseModel):
    plan_id: str = "premium_monthly"
    origin_url: str


class SubscriptionStatusResponse(BaseModel):
    is_premium: bool
    subscription_status: Optional[str] = None
    expires_at: Optional[str] = None
    plan_id: Optional[str] = None
    features: Dict[str, bool]


# ---- Helpers --------------------------------------------------------------
def _premium_features() -> Dict[str, bool]:
    return {
        "oracle_readings_unlimited": True,
        "journal_entries_unlimited": True,
        "all_training_modules": True,
        "spirit_guides": True,
        "binaural_meditation": True,
        "astral_meditation": True,
        "ai_guided_meditation": True,
        "tts_enabled": True,
    }


def _free_features() -> Dict[str, bool]:
    return {
        "oracle_readings_unlimited": False,
        "journal_entries_unlimited": False,
        "all_training_modules": False,
        "spirit_guides": False,
        "binaural_meditation": False,
        "astral_meditation": False,
        "ai_guided_meditation": False,
        "tts_enabled": False,
    }


def _is_active_status(status: str) -> bool:
    """Stripe subscription statuses that count as 'premium'."""
    return status in ("active", "trialing")


async def _set_user_premium(user_id: str, *, plan_id: str, expires_at: datetime,
                            stripe_customer_id: Optional[str] = None,
                            stripe_subscription_id: Optional[str] = None,
                            status: str = "active") -> None:
    """Mark a user as premium and store their Stripe identifiers."""
    update_fields = {
        "is_premium": True,
        "subscription_status": status,
        "subscription_plan": plan_id,
        "subscription_expires_at": expires_at.isoformat(),
        "subscription_activated_at": datetime.now(timezone.utc).isoformat(),
    }
    if stripe_customer_id:
        update_fields["stripe_customer_id"] = stripe_customer_id
    if stripe_subscription_id:
        update_fields["stripe_subscription_id"] = stripe_subscription_id
    await db.users.update_one({"user_id": user_id}, {"$set": update_fields})


async def _set_user_inactive(user_id: str, *, status: str = "canceled") -> None:
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_premium": False, "subscription_status": status}},
    )


async def _find_user_by_customer(customer_id: str) -> Optional[dict]:
    return await db.users.find_one({"stripe_customer_id": customer_id})


# ===========================================================================
# Public endpoints
# ===========================================================================
@router.get("/plans")
async def get_subscription_plans():
    """Public list of available plans (used by the Paywall)."""
    # Strip internal fields from the response
    public = {
        plan_id: {k: v for k, v in plan.items() if k != "stripe_price_id"}
        for plan_id, plan in SUBSCRIPTION_PLANS.items()
    }
    return {"plans": public, "free_tier_limits": FREE_TIER_LIMITS}


@router.get("/status")
async def get_subscription_status(request: Request) -> SubscriptionStatusResponse:
    """Returns the current user's premium state. Reads from MongoDB — kept
    in sync by the webhook handler below."""
    try:
        user = await get_current_user(request)
    except HTTPException:
        # Not signed in → free tier
        return SubscriptionStatusResponse(
            is_premium=False, subscription_status="free", features=_free_features()
        )

    user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    is_premium = bool(user_doc.get("is_premium"))
    expires_at = user_doc.get("subscription_expires_at")

    # Local expiry guard (in case webhook missed an event)
    if is_premium and expires_at:
        if isinstance(expires_at, str):
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        else:
            exp_dt = expires_at
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if exp_dt < datetime.now(timezone.utc):
            is_premium = False
            await _set_user_inactive(user["user_id"], status="expired")

    return SubscriptionStatusResponse(
        is_premium=is_premium,
        subscription_status=user_doc.get("subscription_status") or ("active" if is_premium else "free"),
        expires_at=expires_at if is_premium else None,
        plan_id=user_doc.get("subscription_plan") if is_premium else None,
        features=_premium_features() if is_premium else _free_features(),
    )


# ===========================================================================
# Checkout flow
# ===========================================================================
@router.post("/create-checkout")
async def create_checkout_session(data: CreateCheckoutRequest, request: Request):
    """Create a Stripe Checkout Session in subscription mode and return its URL."""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    user = await get_current_user(request)

    if data.plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    plan = SUBSCRIPTION_PLANS[data.plan_id]
    price_id = plan.get("stripe_price_id")
    if not price_id:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe price ID not configured for {data.plan_id}",
        )

    origin = data.origin_url.rstrip("/")
    success_url = f"{origin}/settings?session_id={{CHECKOUT_SESSION_ID}}&success=true"
    cancel_url = f"{origin}/settings?canceled=true"

    # Re-use an existing Stripe customer if we have one, otherwise let Stripe
    # create one (it'll be attached to this user via metadata + webhook).
    user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
    customer_id = user_doc.get("stripe_customer_id")

    try:
        session_kwargs = dict(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            client_reference_id=user["user_id"],
            metadata={
                "user_id": user["user_id"],
                "email": user.get("email", ""),
                "plan_id": data.plan_id,
            },
            subscription_data={
                "metadata": {
                    "user_id": user["user_id"],
                    "plan_id": data.plan_id,
                }
            },
            allow_promotion_codes=True,
        )
        if customer_id:
            session_kwargs["customer"] = customer_id
        else:
            session_kwargs["customer_email"] = user.get("email")

        # NOTE: We intentionally don't pass an idempotency_key here. The frontend
        # is "one click = one session" and Stripe Checkout sessions are cheap +
        # auto-expire. A real idempotency key would need a stable client-side
        # request ID to be useful; a random one would defeat the purpose.
        session = stripe.checkout.Session.create(**session_kwargs)
    except stripe.error.StripeError as e:
        logger.error(f"[Stripe] create_checkout_session failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to create checkout session")

    # Stash a pending transaction so /checkout-status has something to find
    await db.payment_transactions.insert_one({
        "_id": str(uuid.uuid4()),
        "session_id": session.id,
        "user_id": user["user_id"],
        "email": user.get("email"),
        "plan_id": data.plan_id,
        "amount": plan["price"],
        "currency": plan["currency"],
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"checkout_url": session.url, "session_id": session.id}


@router.get("/checkout-status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Optional poll endpoint the frontend can hit after returning from
    Stripe. The webhook is the authoritative source — this is a convenience
    so the UI can show "Premium activated!" without waiting for webhooks."""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe is not configured")

    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if transaction.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "already_processed": True}

    try:
        sess = stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
    except stripe.error.StripeError as e:
        logger.error(f"[Stripe] retrieve session {session_id} failed: {e}")
        raise HTTPException(status_code=502, detail="Failed to check payment status")

    payment_status = sess.get("payment_status")  # 'paid' | 'unpaid' | 'no_payment_required'
    status = sess.get("status")                  # 'complete' | 'open' | 'expired'

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": payment_status,
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # If paid, activate locally so the UI feels instant. The webhook will
    # later confirm with precise period_end from Stripe.
    if payment_status == "paid":
        user_id = transaction.get("user_id")
        plan_id = transaction.get("plan_id") or "premium_monthly"
        if user_id:
            interval = SUBSCRIPTION_PLANS.get(plan_id, {}).get("interval", "month")
            expires_at = datetime.now(timezone.utc) + timedelta(
                days=INTERVAL_TO_DAYS.get(interval, 31)
            )
            subscription_obj = sess.get("subscription") or {}
            await _set_user_premium(
                user_id,
                plan_id=plan_id,
                expires_at=expires_at,
                stripe_customer_id=sess.get("customer"),
                stripe_subscription_id=(
                    subscription_obj.get("id") if isinstance(subscription_obj, dict)
                    else subscription_obj
                ),
                status="active",
            )

    return {
        "status": status,
        "payment_status": payment_status,
        "amount_total": sess.get("amount_total"),
        "currency": sess.get("currency"),
    }


# ===========================================================================
# Webhook receiver — signature-verified, handles full lifecycle
# ===========================================================================
@webhook_router.post("/stripe")
async def stripe_webhook(request: Request):
    """Receive Stripe webhooks. Signature-verified using STRIPE_WEBHOOK_SECRET."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature") or request.headers.get("Stripe-Signature")

    # If the webhook secret isn't configured yet, still accept the event but
    # log a loud warning — this lets initial dashboard "send test event"
    # clicks confirm the URL works before the secret is wired up.
    event = None
    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"[Stripe webhook] BAD SIGNATURE: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
        except Exception as e:
            logger.error(f"[Stripe webhook] parse error: {e}")
            raise HTTPException(status_code=400, detail="Invalid payload")
    else:
        logger.warning("[Stripe webhook] STRIPE_WEBHOOK_SECRET not set — accepting event WITHOUT signature verification (dev only)")
        try:
            import json
            event = json.loads(payload.decode())
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event.get("type")
    data_object = event.get("data", {}).get("object", {})

    try:
        if event_type == "checkout.session.completed":
            await _handle_checkout_completed(data_object)
        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            await _handle_subscription_change(data_object)
        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(data_object)
        elif event_type == "invoice.payment_failed":
            await _handle_invoice_payment_failed(data_object)
        elif event_type == "invoice.payment_succeeded":
            await _handle_invoice_payment_succeeded(data_object)
        else:
            logger.info(f"[Stripe webhook] Unhandled event type: {event_type}")
    except Exception as e:
        # Never 500 — Stripe would keep retrying. Log and ack so events
        # remain marked as "delivered" in the dashboard.
        logger.error(f"[Stripe webhook] handler error for {event_type}: {e}")

    return {"received": True}


async def _handle_checkout_completed(session: dict) -> None:
    """checkout.session.completed — primary moment a user becomes premium."""
    session_id = session.get("id")
    user_id = (session.get("metadata") or {}).get("user_id") or session.get("client_reference_id")
    if not user_id:
        logger.warning(f"[Stripe webhook] checkout.session.completed without user_id: {session_id}")
        return

    plan_id = (session.get("metadata") or {}).get("plan_id") or "premium_monthly"
    interval = SUBSCRIPTION_PLANS.get(plan_id, {}).get("interval", "month")
    expires_at = datetime.now(timezone.utc) + timedelta(days=INTERVAL_TO_DAYS.get(interval, 31))

    await _set_user_premium(
        user_id,
        plan_id=plan_id,
        expires_at=expires_at,
        stripe_customer_id=session.get("customer"),
        stripe_subscription_id=session.get("subscription"),
        status="active",
    )

    # Mark the transaction paid
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": "paid",
            "webhook_processed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    logger.info(f"[Stripe webhook] Activated premium for user={user_id} plan={plan_id}")


async def _handle_subscription_change(subscription: dict) -> None:
    """customer.subscription.created/updated — keep status + period_end in sync."""
    sub_id = subscription.get("id")
    status = subscription.get("status")
    current_period_end = subscription.get("current_period_end")  # unix ts
    metadata = subscription.get("metadata") or {}
    user_id = metadata.get("user_id")

    # Fallback: look up by customer if metadata didn't carry user_id
    if not user_id:
        customer_id = subscription.get("customer")
        if customer_id:
            doc = await _find_user_by_customer(customer_id)
            if doc:
                user_id = doc["user_id"]
    if not user_id:
        logger.warning(f"[Stripe webhook] subscription change but no user_id mapping (sub={sub_id})")
        return

    plan_id = metadata.get("plan_id") or "premium_monthly"

    if current_period_end:
        expires_at = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
    else:
        interval = SUBSCRIPTION_PLANS.get(plan_id, {}).get("interval", "month")
        expires_at = datetime.now(timezone.utc) + timedelta(days=INTERVAL_TO_DAYS.get(interval, 31))

    if _is_active_status(status):
        await _set_user_premium(
            user_id,
            plan_id=plan_id,
            expires_at=expires_at,
            stripe_customer_id=subscription.get("customer"),
            stripe_subscription_id=sub_id,
            status=status,
        )
    else:
        await _set_user_inactive(user_id, status=status or "canceled")


async def _handle_subscription_deleted(subscription: dict) -> None:
    """customer.subscription.deleted — user is no longer premium."""
    metadata = subscription.get("metadata") or {}
    user_id = metadata.get("user_id")
    if not user_id:
        customer_id = subscription.get("customer")
        if customer_id:
            doc = await _find_user_by_customer(customer_id)
            if doc:
                user_id = doc["user_id"]
    if not user_id:
        return
    await _set_user_inactive(user_id, status="canceled")


async def _handle_invoice_payment_failed(invoice: dict) -> None:
    """invoice.payment_failed — mark past_due. Stripe will retry automatically."""
    customer_id = invoice.get("customer")
    if not customer_id:
        return
    doc = await _find_user_by_customer(customer_id)
    if not doc:
        return
    await db.users.update_one(
        {"user_id": doc["user_id"]},
        {"$set": {"subscription_status": "past_due"}},
    )


async def _handle_invoice_payment_succeeded(invoice: dict) -> None:
    """invoice.payment_succeeded — extend premium on renewal."""
    customer_id = invoice.get("customer")
    if not customer_id:
        return
    doc = await _find_user_by_customer(customer_id)
    if not doc:
        return

    # Extend by the plan interval
    plan_id = doc.get("subscription_plan") or "premium_monthly"
    interval = SUBSCRIPTION_PLANS.get(plan_id, {}).get("interval", "month")
    new_expiry = datetime.now(timezone.utc) + timedelta(days=INTERVAL_TO_DAYS.get(interval, 31))

    await db.users.update_one(
        {"user_id": doc["user_id"]},
        {"$set": {
            "is_premium": True,
            "subscription_status": "active",
            "subscription_expires_at": new_expiry.isoformat(),
        }},
    )


# ===========================================================================
# Feature-access helper (unchanged behavior)
# ===========================================================================
async def check_feature_access(request: Request, feature: str) -> bool:
    """Return True if the current user has access to a feature."""
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]}) or {}
        is_premium = bool(user_doc.get("is_premium"))
        # Local expiry guard
        if is_premium:
            expires_at = user_doc.get("subscription_expires_at")
            if expires_at:
                if isinstance(expires_at, str):
                    exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                else:
                    exp_dt = expires_at
                if exp_dt.tzinfo is None:
                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                if exp_dt < datetime.now(timezone.utc):
                    is_premium = False
        if is_premium:
            return True
        free_access = FREE_TIER_LIMITS.get(feature)
        if isinstance(free_access, bool):
            return free_access
        return free_access is not None
    except HTTPException:
        free_access = FREE_TIER_LIMITS.get(feature)
        if isinstance(free_access, bool):
            return free_access
        return free_access is not None


@user_router.get("/feature-access/{feature}")
async def check_user_feature_access(feature: str, request: Request):
    has_access = await check_feature_access(request, feature)
    return {"feature": feature, "has_access": has_access, "upgrade_required": not has_access}
