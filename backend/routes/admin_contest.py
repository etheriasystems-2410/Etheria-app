"""
Admin Routes - Contest Management and Code Generation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
import os
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Will be set by server.py
db = None

GMAIL_EMAIL = os.getenv("GMAIL_EMAIL", "etheriasystems@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")

def set_db(database):
    global db
    db = database

# Pydantic Models
class CodeCreate(BaseModel):
    code_type: str  # "monthly" or "lifetime"
    custom_code: Optional[str] = None

class SendWinnerEmail(BaseModel):
    user_id: str
    code: str
    contest_id: Optional[str] = None

class SendCodeEmail(BaseModel):
    user_email: str
    user_name: str
    code: str
    code_type: str  # "monthly" or "lifetime"

# Helper functions
async def get_admin_from_token(token: str):
    """Verify admin access"""
    if not token:
        return None
    user = await db.users.find_one({"auth_token": token})
    if not user:
        # Try session token
        session = await db.user_sessions.find_one({"session_token": token})
        if session:
            user = await db.users.find_one({"user_id": session["user_id"]})
    
    if user and user.get("is_admin"):
        return user
    return None

def generate_mystical_code(code_type: str) -> str:
    """Generate a mystical promo code"""
    prefixes = ["MYSTIC", "COSMIC", "LUNAR", "STELLAR", "ETHEREAL", "ASTRAL", "CELESTIAL", "DIVINE", "SPIRIT", "SACRED"]
    elements = ["MOON", "STAR", "SUN", "DREAM", "SOUL", "LIGHT", "FLAME", "CRYSTAL", "OCEAN", "SKY"]
    powers = ["GIFT", "BLESS", "GRACE", "FLOW", "RISE", "BLOOM", "GLOW", "SHINE", "SPARK", "MAGIC"]
    
    prefix = "LIFE" if code_type == "lifetime" else "FREE"
    code = f"{prefix}-{random.choice(prefixes)}-{random.choice(elements)}-{random.randint(100, 999)}"
    return code

async def send_email(to_email: str, subject: str, html_content: str):
    """Send email using Gmail SMTP"""
    if not GMAIL_APP_PASSWORD:
        print(f"Email not sent (no password): {subject}")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = GMAIL_EMAIL
        msg['To'] = to_email
        
        part = MIMEText(html_content, 'html')
        msg.attach(part)
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_EMAIL, to_email, msg.as_string())
        
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

# Contest Management Routes
@router.get("/contest/status")
async def get_contest_status(token: Optional[str] = None):
    """Get current contest status and statistics"""
    admin = await get_admin_from_token(token)
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get current contest
    current_contest = await db.contests.find_one(
        {"status": {"$in": ["active", "pending"]}},
        sort=[("created_at", -1)]
    )
    
    # Get recent contests
    recent_contests = await db.contests.find(
        {}
    ).sort("created_at", -1).limit(5).to_list(length=5)
    
    # Get contest entries count
    entries_count = 0
    if current_contest:
        entries_count = await db.contest_entries.count_documents({
            "contest_id": str(current_contest["_id"])
        })
    
    # Get total codes generated
    total_codes = await db.promo_codes.count_documents({})
    unused_codes = await db.promo_codes.count_documents({"is_used": False})
    
    return {
        "current_contest": {
            "id": str(current_contest["_id"]) if current_contest else None,
            "status": current_contest.get("status") if current_contest else None,
            "start_date": current_contest.get("start_date").isoformat() if current_contest and current_contest.get("start_date") else None,
            "end_date": current_contest.get("end_date").isoformat() if current_contest and current_contest.get("end_date") else None,
            "entries_count": entries_count
        } if current_contest else None,
        "recent_contests": [{
            "id": str(c["_id"]),
            "status": c.get("status"),
            "winner_email": c.get("winner_email"),
            "created_at": c.get("created_at").isoformat() if c.get("created_at") else None
        } for c in recent_contests],
        "codes_stats": {
            "total": total_codes,
            "unused": unused_codes,
            "used": total_codes - unused_codes
        }
    }

@router.get("/contest/entries")
async def get_contest_entries(token: Optional[str] = None, contest_id: Optional[str] = None):
    """Get all contest entries with eligibility status"""
    admin = await get_admin_from_token(token)
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get current or specified contest
    if contest_id:
        contest = await db.contests.find_one({"_id": ObjectId(contest_id)})
    else:
        contest = await db.contests.find_one(
            {"status": {"$in": ["active", "pending"]}},
            sort=[("created_at", -1)]
        )
    
    if not contest:
        return {"entries": [], "contest": None}
    
    # Get all eligible users (premium users who logged in during contest period)
    start_date = contest.get("start_date", datetime.utcnow() - timedelta(days=14))
    end_date = contest.get("end_date", datetime.utcnow())
    
    # Get premium users
    premium_users = []
    
    # Check subscriptions
    active_subs = await db.subscriptions.find({"status": "active"}).to_list(length=500)
    sub_user_ids = [s["user_id"] for s in active_subs]
    
    # Get users with lifetime premium or active subscription
    eligible_users = await db.users.find({
        "$or": [
            {"lifetime_premium": True},
            {"user_id": {"$in": sub_user_ids}}
        ]
    }).to_list(length=500)
    
    entries = []
    for user in eligible_users:
        # Check activity during contest period
        journal_count = await db.journal_entries.count_documents({
            "user_id": user.get("user_id"),
            "created_at": {"$gte": start_date, "$lte": end_date}
        })
        
        meditation_count = await db.meditation_sessions.count_documents({
            "user_id": user.get("user_id"),
            "created_at": {"$gte": start_date, "$lte": end_date}
        })
        
        oracle_count = await db.oracle_readings.count_documents({
            "user_id": user.get("user_id"),
            "created_at": {"$gte": start_date, "$lte": end_date}
        })
        
        total_activity = journal_count + meditation_count + oracle_count
        
        entries.append({
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "name": user.get("display_name") or user.get("name"),
            "is_premium": True,
            "is_lifetime": user.get("lifetime_premium", False),
            "activity_score": total_activity,
            "journal_entries": journal_count,
            "meditation_sessions": meditation_count,
            "oracle_readings": oracle_count,
            "eligible": total_activity >= 3  # Minimum 3 activities to be eligible
        })
    
    # Sort by activity score
    entries.sort(key=lambda x: x["activity_score"], reverse=True)
    
    return {
        "contest": {
            "id": str(contest["_id"]),
            "start_date": contest.get("start_date").isoformat() if contest.get("start_date") else None,
            "end_date": contest.get("end_date").isoformat() if contest.get("end_date") else None,
            "status": contest.get("status")
        },
        "entries": entries,
        "total_eligible": len([e for e in entries if e["eligible"]])
    }

@router.post("/contest/generate-code")
async def generate_promo_code(code_data: CodeCreate, token: Optional[str] = None):
    """Generate a new promo code (monthly or lifetime)"""
    admin = await get_admin_from_token(token)
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if code_data.code_type not in ["monthly", "lifetime"]:
        raise HTTPException(status_code=400, detail="Invalid code type. Use 'monthly' or 'lifetime'")
    
    # Use custom code or generate one
    if code_data.custom_code:
        code = code_data.custom_code.upper().strip()
        # Check if already exists
        existing = await db.promo_codes.find_one({"code": code})
        if existing:
            raise HTTPException(status_code=400, detail="Code already exists")
    else:
        # Generate unique code
        while True:
            code = generate_mystical_code(code_data.code_type)
            existing = await db.promo_codes.find_one({"code": code})
            if not existing:
                break
    
    # Create code
    code_doc = {
        "code": code,
        "type": code_data.code_type,
        "is_used": False,
        "created_at": datetime.utcnow(),
        "created_by": admin.get("email"),
        "used_by": None,
        "used_at": None
    }
    
    await db.promo_codes.insert_one(code_doc)
    
    return {
        "success": True,
        "code": code,
        "type": code_data.code_type
    }

@router.get("/contest/codes")
async def get_all_codes(token: Optional[str] = None, limit: int = 50):
    """Get all promo codes"""
    admin = await get_admin_from_token(token)
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    codes = await db.promo_codes.find({}).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    return {
        "codes": [{
            "code": c["code"],
            "type": c.get("type", "monthly"),
            "is_used": c.get("is_used", False),
            "used_by": c.get("used_by"),
            "used_at": c.get("used_at").isoformat() if c.get("used_at") else None,
            "created_at": c.get("created_at").isoformat() if c.get("created_at") else None
        } for c in codes]
    }

@router.post("/contest/send-winner-email")
async def send_winner_email(data: SendWinnerEmail, token: Optional[str] = None):
    """Send congratulations email to contest winner"""
    admin = await get_admin_from_token(token)
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get user
    user = await db.users.find_one({"user_id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_email = user.get("email")
    user_name = user.get("display_name") or user.get("name") or user_email.split("@")[0]
    
    # Get code details
    code_doc = await db.promo_codes.find_one({"code": data.code})
    code_type = code_doc.get("type", "monthly") if code_doc else "monthly"
    
    duration = "one month" if code_type == "monthly" else "lifetime"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a0033; color: #e9d5ff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2d1b4e; padding: 30px; border-radius: 12px;">
            <h1 style="color: #ffd700; text-align: center;">🎉 Congratulations! 🎉</h1>
            
            <p style="font-size: 18px; text-align: center;">Hello {user_name},</p>
            
            <p style="text-align: center; font-size: 16px;">
                You have been selected as the winner of our bi-weekly Etheria contest!
            </p>
            
            <div style="background-color: #1a0033; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                <p style="color: #9f7aea; margin-bottom: 10px;">Your Prize: <strong style="color: #ffd700;">{duration.title()} Premium Membership</strong></p>
                <p style="font-size: 12px; color: #9f7aea;">Your Redemption Code:</p>
                <p style="font-size: 28px; font-weight: bold; color: #10b981; letter-spacing: 2px;">{data.code}</p>
            </div>
            
            <p style="text-align: center;">
                To redeem your prize, open the Etheria app, go to Settings, and enter this code in the "Redeem Code" section.
            </p>
            
            <p style="text-align: center; color: #9f7aea; margin-top: 30px;">
                Thank you for being part of the Etheria community!<br>
                ✨ May your spiritual journey continue to flourish ✨
            </p>
            
            <p style="text-align: center; color: #b794f6; margin-top: 20px;">
                Blessings,<br>The Etheria Team
            </p>
        </div>
    </body>
    </html>
    """
    
    success = await send_email(user_email, "🎉 You Won! Etheria Contest Winner", html_content)
    
    if success:
        # Log the win
        await db.contest_winners.insert_one({
            "user_id": data.user_id,
            "user_email": user_email,
            "code": data.code,
            "contest_id": data.contest_id,
            "sent_at": datetime.utcnow()
        })
        
        return {"success": True, "message": f"Congratulations email sent to {user_email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")

@router.post("/contest/send-code-email")
async def send_code_to_user(data: SendCodeEmail, token: Optional[str] = None):
    """Send a promo code to any user via email"""
    admin = await get_admin_from_token(token)
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    duration = "one month" if data.code_type == "monthly" else "lifetime"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a0033; color: #e9d5ff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2d1b4e; padding: 30px; border-radius: 12px;">
            <h2 style="color: #b794f6; text-align: center;">✨ A Gift From Etheria ✨</h2>
            
            <p style="font-size: 18px; text-align: center;">Hello {data.user_name},</p>
            
            <p style="text-align: center; font-size: 16px;">
                We're delighted to share a special gift with you!
            </p>
            
            <div style="background-color: #1a0033; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                <p style="color: #9f7aea; margin-bottom: 10px;">Your Gift: <strong style="color: #ffd700;">{duration.title()} Premium Membership</strong></p>
                <p style="font-size: 12px; color: #9f7aea;">Your Redemption Code:</p>
                <p style="font-size: 28px; font-weight: bold; color: #10b981; letter-spacing: 2px;">{data.code}</p>
            </div>
            
            <p style="text-align: center;">
                To redeem, open the Etheria app, go to Settings, and enter this code in the "Redeem Code" section.
            </p>
            
            <p style="text-align: center; color: #b794f6; margin-top: 30px;">
                Blessings,<br>The Etheria Team
            </p>
        </div>
    </body>
    </html>
    """
    
    success = await send_email(data.user_email, "✨ Your Etheria Premium Gift", html_content)
    
    if success:
        return {"success": True, "message": f"Code email sent to {data.user_email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")
