"""
Subscription and payment endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta
import uuid
import logging

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
from .deps import db, STRIPE_API_KEY, SUBSCRIPTION_PLANS, FREE_TIER_LIMITS
from .auth_utils import get_current_user

router = APIRouter(prefix="/subscription", tags=["subscription"])


# Models
class CreateCheckoutRequest(BaseModel):
    plan_id: str = "premium_monthly"
    origin_url: str


class SubscriptionStatusResponse(BaseModel):
    is_premium: bool
    subscription_status: Optional[str] = None
    expires_at: Optional[str] = None
    features: Dict[str, bool]


@router.get("/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return {
        "plans": SUBSCRIPTION_PLANS,
        "free_tier_limits": FREE_TIER_LIMITS
    }


@router.get("/status")
async def get_subscription_status(request: Request):
    """Get current user subscription status"""
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]})
        
        is_premium = user_doc.get("is_premium", False)
        subscription_expires = user_doc.get("subscription_expires_at")
        
        # Check if subscription expired
        if subscription_expires:
            if isinstance(subscription_expires, str):
                expires_dt = datetime.fromisoformat(subscription_expires.replace('Z', '+00:00'))
            else:
                expires_dt = subscription_expires
            if expires_dt.tzinfo is None:
                expires_dt = expires_dt.replace(tzinfo=timezone.utc)
            if expires_dt < datetime.now(timezone.utc):
                is_premium = False
                # Update user status
                await db.users.update_one(
                    {"user_id": user["user_id"]},
                    {"$set": {"is_premium": False}}
                )
        
        # Return premium features or free tier limits
        if is_premium:
            features = {
                "oracle_readings_unlimited": True,
                "journal_entries_unlimited": True,
                "all_training_modules": True,
                "spirit_guides": True,
                "binaural_meditation": True,
                "astral_meditation": True,
                "ai_guided_meditation": True,
                "tts_enabled": True
            }
        else:
            features = {
                "oracle_readings_unlimited": False,
                "journal_entries_unlimited": False,
                "all_training_modules": False,
                "spirit_guides": False,
                "binaural_meditation": False,
                "astral_meditation": False,
                "ai_guided_meditation": False,
                "tts_enabled": False
            }
        
        return SubscriptionStatusResponse(
            is_premium=is_premium,
            subscription_status="active" if is_premium else "free",
            expires_at=subscription_expires if is_premium else None,
            features=features
        )
    except HTTPException:
        # Not authenticated - return free tier
        return SubscriptionStatusResponse(
            is_premium=False,
            subscription_status="free",
            features={
                "oracle_readings_unlimited": False,
                "journal_entries_unlimited": False,
                "all_training_modules": False,
                "spirit_guides": False,
                "binaural_meditation": False,
                "astral_meditation": False,
                "ai_guided_meditation": False,
                "tts_enabled": False
            }
        )


@router.post("/create-checkout")
async def create_checkout_session(data: CreateCheckoutRequest, request: Request):
    """Create Stripe checkout session for subscription"""
    try:
        user = await get_current_user(request)
        
        # Validate plan exists
        if data.plan_id not in SUBSCRIPTION_PLANS:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        plan = SUBSCRIPTION_PLANS[data.plan_id]
        
        # Build URLs from frontend origin
        success_url = f"{data.origin_url}/settings?session_id={{CHECKOUT_SESSION_ID}}&success=true"
        cancel_url = f"{data.origin_url}/settings?canceled=true"
        
        # Initialize Stripe checkout
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=plan["price"],
            currency=plan["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user["user_id"],
                "email": user["email"],
                "plan_id": data.plan_id,
                "type": "subscription"
            }
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store payment transaction
        transaction = {
            "_id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "email": user["email"],
            "plan_id": data.plan_id,
            "amount": plan["price"],
            "currency": plan["currency"],
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


@router.get("/checkout-status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Get status of a checkout session and update subscription"""
    try:
        # Find the transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Check if already processed
        if transaction.get("payment_status") == "paid":
            return {
                "status": "complete",
                "payment_status": "paid",
                "already_processed": True
            }
        
        # Get status from Stripe
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": checkout_status.payment_status,
                "status": checkout_status.status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If payment successful, activate subscription
        if checkout_status.payment_status == "paid":
            # Get user_id from transaction
            user_id = transaction.get("user_id")
            
            if user_id:
                # Activate premium for 30 days
                expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "is_premium": True,
                        "subscription_expires_at": expires_at.isoformat(),
                        "subscription_plan": transaction.get("plan_id"),
                        "subscription_activated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logging.info(f"Subscription activated for user {user_id}")
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Checkout status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")


# Webhook router
webhook_router = APIRouter(prefix="/webhook", tags=["webhook"])


@webhook_router.post("/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process webhook event
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            
            # Update transaction
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            if transaction:
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "paid",
                        "webhook_processed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Activate subscription
                user_id = transaction.get("user_id")
                if user_id:
                    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                    await db.users.update_one(
                        {"user_id": user_id},
                        {"$set": {
                            "is_premium": True,
                            "subscription_expires_at": expires_at.isoformat()
                        }}
                    )
        
        return {"received": True}
        
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        return {"received": True, "error": str(e)}


# User feature access router
user_router = APIRouter(prefix="/user", tags=["user"])


async def check_feature_access(request: Request, feature: str) -> bool:
    """Check if user has access to a specific feature"""
    try:
        user = await get_current_user(request)
        user_doc = await db.users.find_one({"user_id": user["user_id"]})
        
        is_premium = user_doc.get("is_premium", False)
        
        # Check subscription expiry
        if is_premium:
            subscription_expires = user_doc.get("subscription_expires_at")
            if subscription_expires:
                if isinstance(subscription_expires, str):
                    expires_dt = datetime.fromisoformat(subscription_expires.replace('Z', '+00:00'))
                else:
                    expires_dt = subscription_expires
                if expires_dt.tzinfo is None:
                    expires_dt = expires_dt.replace(tzinfo=timezone.utc)
                if expires_dt < datetime.now(timezone.utc):
                    is_premium = False
        
        # Premium users have access to everything
        if is_premium:
            return True
        
        # Free tier access check
        free_access = FREE_TIER_LIMITS.get(feature)
        
        # Boolean features
        if isinstance(free_access, bool):
            return free_access
        
        # Numeric limits require additional logic in the calling endpoint
        return free_access is not None
        
    except HTTPException:
        # Not authenticated - check free tier
        free_access = FREE_TIER_LIMITS.get(feature)
        if isinstance(free_access, bool):
            return free_access
        return free_access is not None


@user_router.get("/feature-access/{feature}")
async def check_user_feature_access(feature: str, request: Request):
    """Check if user has access to a specific feature"""
    has_access = await check_feature_access(request, feature)
    
    return {
        "feature": feature,
        "has_access": has_access,
        "upgrade_required": not has_access
    }
