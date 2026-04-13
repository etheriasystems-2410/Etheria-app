"""
AI-Powered Bi-Weekly Contest Service for Etheria
Automatically selects winners and distributes unique free month membership codes
"""
import asyncio
import random
import string
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mystical code components for AI-generated codes
MYSTICAL_WORDS = {
    "prefixes": ["MYSTIC", "COSMIC", "LUNAR", "STELLAR", "ETHEREAL", "ASTRAL", "CELESTIAL", "SACRED", "DIVINE", "SPIRIT"],
    "elements": ["MOON", "STAR", "SUN", "DREAM", "SOUL", "LIGHT", "FLAME", "WAVE", "WIND", "CRYSTAL"],
    "powers": ["GIFT", "BLESS", "GRACE", "FLOW", "RISE", "BLOOM", "GLOW", "SHINE", "SPARK", "MAGIC"]
}

# Protected codes that should never be regenerated
PROTECTED_CODES = ["DIVINE-MOON-ASCEND"]


class BiWeeklyContestService:
    """AI-powered service for managing bi-weekly contests"""
    
    def __init__(self, db, emergent_llm_key: str, gmail_email: str, gmail_password: str):
        self.db = db
        self.emergent_llm_key = emergent_llm_key
        self.gmail_email = gmail_email
        self.gmail_password = gmail_password
    
    async def generate_unique_code(self) -> str:
        """Generate a unique mystical promo code using AI"""
        try:
            # Try AI-generated code first
            chat = LlmChat(
                api_key=self.emergent_llm_key,
                session_id=f"code-gen-{datetime.now().timestamp()}",
                system_message="""You are a mystical code generator for a spiritual app called Etheria. 
Generate a single unique promotional code in the format: WORD-WORD-WORD (3 mystical/cosmic words separated by hyphens).
Use spiritual, cosmic, or mystical terminology. Keep it uppercase.
Examples: LUNAR-SPIRIT-RISE, COSMIC-DREAM-FLOW, MYSTIC-STAR-BLOOM
Just output the code, nothing else."""
            ).with_model("gemini", "gemini-2.0-flash")
            
            response = await chat.send_message(UserMessage(text="Generate a unique mystical promo code now."))
            code = response.strip().upper().replace(" ", "-")
            
            # Validate format
            if len(code.split("-")) == 3 and 10 <= len(code) <= 25:
                # Check it's not protected or already used
                if code not in PROTECTED_CODES:
                    existing = await self.db.contest_codes.find_one({"code": code})
                    if not existing:
                        return code
        except Exception as e:
            logger.error(f"AI code generation failed: {e}")
        
        # Fallback to random generation
        while True:
            code = f"{random.choice(MYSTICAL_WORDS['prefixes'])}-{random.choice(MYSTICAL_WORDS['elements'])}-{random.choice(MYSTICAL_WORDS['powers'])}"
            # Add random suffix for uniqueness
            code += f"-{random.randint(10, 99)}"
            
            if code not in PROTECTED_CODES:
                existing = await self.db.contest_codes.find_one({"code": code})
                if not existing:
                    return code
    
    async def calculate_engagement_score(self, user_id: str, period_start: datetime, period_end: datetime) -> Dict:
        """Calculate user engagement score for AI-based winner selection"""
        
        # Get usage data
        usage_sessions = await self.db.usage_tracking.find({
            "user_id": user_id,
            "timestamp": {"$gte": period_start.isoformat(), "$lt": period_end.isoformat()}
        }).to_list(None)
        
        total_usage_seconds = sum(s.get("duration_seconds", 0) for s in usage_sessions)
        session_count = len(usage_sessions)
        
        # Get journal entries
        journal_entries = await self.db.journal_entries.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": period_start.isoformat(), "$lt": period_end.isoformat()}
        })
        
        # Get oracle readings
        oracle_readings = await self.db.oracle_readings.count_documents({
            "user_id": user_id,
            "saved_at": {"$gte": period_start.isoformat(), "$lt": period_end.isoformat()}
        })
        
        # Get meditation sessions
        meditation_sessions = await self.db.meditation_sessions.count_documents({
            "user_id": user_id,
            "completed_at": {"$gte": period_start.isoformat(), "$lt": period_end.isoformat()}
        })
        
        # Calculate engagement score (weighted)
        score = (
            (total_usage_seconds / 60) * 1.0 +  # 1 point per minute
            session_count * 5 +                   # 5 points per session
            journal_entries * 10 +                # 10 points per journal entry
            oracle_readings * 8 +                 # 8 points per oracle reading
            meditation_sessions * 15              # 15 points per meditation
        )
        
        return {
            "user_id": user_id,
            "score": round(score, 2),
            "usage_minutes": round(total_usage_seconds / 60, 2),
            "session_count": session_count,
            "journal_entries": journal_entries,
            "oracle_readings": oracle_readings,
            "meditation_sessions": meditation_sessions
        }
    
    async def select_winner_with_ai(self, eligible_users: List[Dict], contest_period: Dict) -> Optional[Dict]:
        """Use AI to select the most deserving winner based on engagement"""
        
        if not eligible_users:
            return None
        
        # Calculate engagement scores for all eligible users
        period_start = contest_period["start"]
        period_end = contest_period["end"]
        
        user_scores = []
        for user in eligible_users:
            user_id = user.get("user_id") or str(user.get("_id"))
            score_data = await self.calculate_engagement_score(user_id, period_start, period_end)
            score_data["email"] = user.get("email")
            score_data["name"] = user.get("name", "Seeker")
            user_scores.append(score_data)
        
        # Sort by engagement score
        user_scores.sort(key=lambda x: x["score"], reverse=True)
        
        # If we have scores, use weighted random selection favoring higher engagement
        if user_scores:
            # Top 30% have higher chance, but still random element for fairness
            top_tier_count = max(1, len(user_scores) // 3)
            top_tier = user_scores[:top_tier_count]
            
            # Weighted selection: higher scores = higher probability
            total_score = sum(u["score"] + 1 for u in top_tier)  # +1 to avoid zero
            if total_score > 0:
                rand_val = random.uniform(0, total_score)
                cumulative = 0
                for user in top_tier:
                    cumulative += user["score"] + 1
                    if rand_val <= cumulative:
                        return user
            
            # Fallback to highest scorer
            return top_tier[0]
        
        # Fallback to random selection
        return random.choice(eligible_users) if eligible_users else None
    
    async def get_eligible_users(self) -> List[Dict]:
        """Get all eligible users (free users only, not premium)"""
        
        now = datetime.now(timezone.utc)
        
        # Find all users who are NOT premium
        users = await self.db.users.find({
            "$or": [
                {"is_premium": {"$ne": True}},
                {"is_premium": False},
                {"is_premium": {"$exists": False}},
                # Also include users whose premium has expired
                {"subscription_expires_at": {"$lt": now.isoformat()}}
            ]
        }).to_list(None)
        
        # Filter out users who won in the last 60 days
        sixty_days_ago = now - timedelta(days=60)
        recent_winners = await self.db.contest_winners.find({
            "won_at": {"$gte": sixty_days_ago.isoformat()}
        }).to_list(None)
        recent_winner_ids = {w.get("user_id") for w in recent_winners}
        
        eligible = []
        for user in users:
            user_id = user.get("user_id") or str(user.get("_id"))
            if user_id not in recent_winner_ids:
                eligible.append(user)
        
        return eligible
    
    async def send_winner_email(self, winner: Dict, code: str, expires_at: datetime) -> bool:
        """Send email notification to contest winner"""
        
        if not self.gmail_email or not self.gmail_password:
            logger.error("Gmail credentials not configured")
            return False
        
        try:
            email = winner.get("email")
            name = winner.get("name", "Spiritual Seeker")
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = '🎉 Congratulations! You Won the Etheria Bi-Weekly Contest!'
            msg['From'] = self.gmail_email
            msg['To'] = email
            
            text = f"""
Congratulations, {name}! 🌟

You have been selected as the winner of Etheria's bi-weekly spiritual journey contest!

Your dedication to your spiritual practice has been recognized by the cosmos, and you have been chosen to receive:

🎁 ONE MONTH OF FREE PREMIUM ACCESS 🎁

Your unique mystical code:
━━━━━━━━━━━━━━━━━━━━━━━━━━
{code}
━━━━━━━━━━━━━━━━━━━━━━━━━━

This code expires on: {expires_at.strftime("%B %d, %Y")}

How to redeem:
1. Open the Etheria app
2. Go to Settings
3. Tap "Have a code?"
4. Enter your unique code: {code}
5. Enjoy your free month of premium features!

Premium Features Include:
✨ Unlimited Oracle readings with AI
🧘 All Meditation features (Binaural, Chakra, Guided)
👻 Access to all Spirit Guides
📓 Unlimited Journal entries
🎓 All Training modules
🌙 Dream Interpretation
🚀 Astral Travel lessons

Keep nurturing your spiritual growth, and may the stars guide your journey!

With cosmic blessings,
The Etheria Team

P.S. This code is unique to you and cannot be shared. Continue your spiritual journey to be eligible for future contests!
            """
            
            html = f"""
<html>
<body style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #1a0a2e 0%, #0f0321 100%); color: #e9d5ff; padding: 40px;">
    <div style="max-width: 600px; margin: 0 auto; background: rgba(45, 27, 78, 0.9); border-radius: 20px; padding: 40px; border: 1px solid #7c3aed;">
        <h1 style="color: #fbbf24; text-align: center;">🎉 Congratulations, {name}! 🎉</h1>
        
        <p style="font-size: 18px; text-align: center; color: #c4b5fd;">
            You have been selected as the winner of Etheria's bi-weekly spiritual journey contest!
        </p>
        
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 15px; padding: 30px; margin: 30px 0; text-align: center;">
            <p style="color: #fff; font-size: 16px; margin-bottom: 10px;">🎁 ONE MONTH FREE PREMIUM 🎁</p>
            <p style="color: #fbbf24; font-size: 28px; font-weight: bold; letter-spacing: 3px; font-family: monospace;">
                {code}
            </p>
            <p style="color: #e9d5ff; font-size: 14px; margin-top: 10px;">
                Expires: {expires_at.strftime("%B %d, %Y")}
            </p>
        </div>
        
        <h3 style="color: #a855f7;">How to Redeem:</h3>
        <ol style="color: #c4b5fd;">
            <li>Open the Etheria app</li>
            <li>Go to Settings</li>
            <li>Tap "Have a code?"</li>
            <li>Enter your code</li>
            <li>Enjoy premium features!</li>
        </ol>
        
        <p style="text-align: center; color: #9f7aea; font-style: italic; margin-top: 30px;">
            May the stars guide your spiritual journey! ✨
        </p>
        
        <p style="text-align: center; color: #7c3aed; font-size: 12px;">
            The Etheria Team
        </p>
    </div>
</body>
</html>
            """
            
            part1 = MIMEText(text, 'plain')
            part2 = MIMEText(html, 'html')
            msg.attach(part1)
            msg.attach(part2)
            
            server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
            server.login(self.gmail_email, self.gmail_password)
            server.sendmail(self.gmail_email, email, msg.as_string())
            server.quit()
            
            logger.info(f"Winner email sent to {email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send winner email: {e}")
            return False
    
    async def create_in_app_notification(self, user_id: str, code: str, expires_at: datetime) -> bool:
        """Create in-app notification for the winner"""
        
        try:
            notification = {
                "user_id": user_id,
                "type": "contest_winner",
                "title": "🎉 You Won the Bi-Weekly Contest!",
                "message": f"Congratulations! Use code {code} for 1 month FREE premium!",
                "code": code,
                "expires_at": expires_at.isoformat(),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.db.notifications.insert_one(notification)
            logger.info(f"In-app notification created for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create in-app notification: {e}")
            return False
    
    async def run_contest(self, manual_trigger: bool = False) -> Dict:
        """Run the bi-weekly contest and select a winner"""
        
        now = datetime.now(timezone.utc)
        
        # Define contest period (last 2 weeks)
        contest_end = now
        contest_start = now - timedelta(days=14)
        
        contest_period = {
            "start": contest_start,
            "end": contest_end
        }
        
        logger.info(f"Running bi-weekly contest for period: {contest_start.date()} to {contest_end.date()}")
        
        # Check if contest already ran today
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        existing_contest = await self.db.contests.find_one({
            "run_at": {"$gte": today_start.isoformat()}
        })
        
        if existing_contest and not manual_trigger:
            logger.info("Contest already ran today, skipping")
            return {
                "success": False,
                "message": "Contest already ran today",
                "last_contest": existing_contest
            }
        
        # Get eligible users
        eligible_users = await self.get_eligible_users()
        
        if not eligible_users:
            logger.warning("No eligible users for contest")
            return {
                "success": False,
                "message": "No eligible users found",
                "eligible_count": 0
            }
        
        logger.info(f"Found {len(eligible_users)} eligible users")
        
        # Select winner using AI-powered engagement scoring
        winner = await self.select_winner_with_ai(eligible_users, contest_period)
        
        if not winner:
            return {
                "success": False,
                "message": "Failed to select winner",
                "eligible_count": len(eligible_users)
            }
        
        # Generate unique code for winner
        unique_code = await self.generate_unique_code()
        code_expires = now + timedelta(days=30)  # Code valid for 30 days
        premium_expires = now + timedelta(days=30)  # 1 month premium
        
        # Store the code
        code_doc = {
            "code": unique_code,
            "type": "contest_winner",
            "contest_date": now.isoformat(),
            "winner_user_id": winner.get("user_id") or winner.get("_id"),
            "winner_email": winner.get("email"),
            "code_expires_at": code_expires.isoformat(),
            "premium_duration_days": 30,
            "is_active": True,
            "redeemed": False,
            "created_at": now.isoformat()
        }
        await self.db.contest_codes.insert_one(code_doc)
        
        # Also add to promo_codes collection for redemption
        promo_doc = {
            "code": unique_code,
            "type": "contest_monthly",
            "description": "Bi-Weekly Contest Winner - 1 Month Premium",
            "created_at": now,
            "expires_at": code_expires,
            "is_active": True,
            "max_redemptions": 1,
            "redemptions": [],
            "winner_user_id": winner.get("user_id") or winner.get("_id"),
            "grants": {
                "is_premium": True,
                "subscription_type": "monthly",
                "duration_days": 30
            }
        }
        await self.db.promo_codes.insert_one(promo_doc)
        
        # Record winner
        winner_record = {
            "user_id": winner.get("user_id") or winner.get("_id"),
            "email": winner.get("email"),
            "name": winner.get("name"),
            "code": unique_code,
            "engagement_score": winner.get("score", 0),
            "contest_period_start": contest_start.isoformat(),
            "contest_period_end": contest_end.isoformat(),
            "won_at": now.isoformat(),
            "code_expires_at": code_expires.isoformat(),
            "email_sent": False,
            "notification_created": False
        }
        
        # Send notifications
        email_sent = await self.send_winner_email(winner, unique_code, code_expires)
        notification_created = await self.create_in_app_notification(
            winner.get("user_id") or str(winner.get("_id")),
            unique_code,
            code_expires
        )
        
        winner_record["email_sent"] = email_sent
        winner_record["notification_created"] = notification_created
        
        await self.db.contest_winners.insert_one(winner_record)
        
        # Record contest run
        contest_record = {
            "run_at": now.isoformat(),
            "period_start": contest_start.isoformat(),
            "period_end": contest_end.isoformat(),
            "eligible_users_count": len(eligible_users),
            "winner_user_id": winner.get("user_id") or winner.get("_id"),
            "winner_email": winner.get("email"),
            "winner_engagement_score": winner.get("score", 0),
            "code_generated": unique_code,
            "email_sent": email_sent,
            "notification_created": notification_created,
            "manual_trigger": manual_trigger
        }
        await self.db.contests.insert_one(contest_record)
        
        logger.info(f"Contest completed! Winner: {winner.get('email')} with code: {unique_code}")
        
        return {
            "success": True,
            "message": "Contest completed successfully",
            "winner": {
                "email": winner.get("email"),
                "name": winner.get("name"),
                "engagement_score": winner.get("score", 0)
            },
            "code": unique_code,
            "code_expires": code_expires.isoformat(),
            "eligible_count": len(eligible_users),
            "email_sent": email_sent,
            "notification_created": notification_created
        }
    
    async def get_contest_history(self, limit: int = 10) -> List[Dict]:
        """Get recent contest history"""
        
        contests = await self.db.contests.find().sort("run_at", -1).limit(limit).to_list(limit)
        return contests
    
    async def get_next_contest_date(self) -> datetime:
        """Calculate the next contest run date (every 2 weeks on Sunday)"""
        
        now = datetime.now(timezone.utc)
        
        # Find next Sunday
        days_until_sunday = (6 - now.weekday()) % 7
        if days_until_sunday == 0 and now.hour >= 12:
            days_until_sunday = 7
        
        next_sunday = now + timedelta(days=days_until_sunday)
        next_sunday = next_sunday.replace(hour=12, minute=0, second=0, microsecond=0)
        
        # Check if this is a contest Sunday (every 2 weeks)
        # We use epoch to determine bi-weekly schedule
        epoch = datetime(2024, 1, 7, 12, 0, 0, tzinfo=timezone.utc)  # A known Sunday
        weeks_since_epoch = (next_sunday - epoch).days // 7
        
        if weeks_since_epoch % 2 != 0:
            next_sunday += timedelta(days=7)
        
        return next_sunday


# Scheduler function to be called by a cron job or background task
async def scheduled_contest_run(db, emergent_key: str, gmail_email: str, gmail_password: str):
    """Scheduled function to run the bi-weekly contest"""
    
    service = BiWeeklyContestService(db, emergent_key, gmail_email, gmail_password)
    
    # Check if it's time to run (every 2 weeks on Sunday at noon UTC)
    now = datetime.now(timezone.utc)
    
    # Only run on Sundays
    if now.weekday() != 6:
        logger.info("Not Sunday, skipping contest check")
        return None
    
    # Check bi-weekly schedule
    epoch = datetime(2024, 1, 7, 12, 0, 0, tzinfo=timezone.utc)
    weeks_since_epoch = (now - epoch).days // 7
    
    if weeks_since_epoch % 2 != 0:
        logger.info("Not a contest week, skipping")
        return None
    
    # Run the contest
    result = await service.run_contest()
    return result
