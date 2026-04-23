"""
User Moderation Service - Handles flagging, warnings, suspensions, and bans
Also includes inbound email parsing for admin reply commands
"""
import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any
import os
import re
import asyncio
from dotenv import load_dotenv

load_dotenv()

ADMIN_EMAIL = "etheriasystems@gmail.com"
GMAIL_EMAIL = os.getenv("GMAIL_EMAIL", "etheriasystems@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")

# IMAP Configuration for Gmail
IMAP_SERVER = "imap.gmail.com"
IMAP_PORT = 993

# Valid moderation commands from email replies
VALID_COMMANDS = {
    "good": "approve",      # Content is acceptable, dismiss flag
    "okay": "approve",      # Alias for good
    "bad": "warn",          # Issue warning to user
    "cancel": "cancel"      # Cancel the user's account immediately
}

# Import ObjectId for MongoDB operations
from bson import ObjectId

# Suspension durations
FIRST_SUSPENSION_DAYS = 14  # 2 weeks
SECOND_SUSPENSION_DAYS = 30  # 30 days
FLAGS_BEFORE_SUSPENSION = 3

async def send_email(to_email: str, subject: str, html_content: str, text_content: str = None):
    """Send email using Gmail SMTP"""
    if not GMAIL_APP_PASSWORD:
        print(f"Email not sent (no password configured): {subject} to {to_email}")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = GMAIL_EMAIL
        msg['To'] = to_email
        
        if text_content:
            part1 = MIMEText(text_content, 'plain')
            msg.attach(part1)
        
        part2 = MIMEText(html_content, 'html')
        msg.attach(part2)
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_EMAIL, to_email, msg.as_string())
        
        print(f"Email sent: {subject} to {to_email}")
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

async def send_flagged_content_notification(
    db,
    user_id: str,
    user_email: str,
    user_name: str,
    content_type: str,
    content: str,
    reason: str,
    flag_id: str
):
    """Send notification to admin about flagged content with reply-based action support"""
    # Include flag_id in subject for easy parsing of replies
    subject = f"Flagged for Review [FLAG:{flag_id}]"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a0033; color: #e9d5ff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2d1b4e; padding: 30px; border-radius: 12px;">
            <h2 style="color: #b794f6; margin-bottom: 20px;">🚩 Content Flagged for Review</h2>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong style="color: #9f7aea;">User:</strong> {user_name}</p>
                <p><strong style="color: #9f7aea;">Email:</strong> {user_email}</p>
                <p><strong style="color: #9f7aea;">User ID:</strong> {user_id}</p>
                <p><strong style="color: #9f7aea;">Content Type:</strong> {content_type}</p>
                <p><strong style="color: #9f7aea;">Flag ID:</strong> {flag_id}</p>
            </div>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong style="color: #9f7aea;">Reason:</strong></p>
                <p style="color: #ef4444;">{reason}</p>
            </div>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong style="color: #9f7aea;">Flagged Content:</strong></p>
                <p style="color: #c4b5fd; font-style: italic;">"{content[:500]}{'...' if len(content) > 500 else ''}"</p>
            </div>
            
            <div style="background-color: #1a0033; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #ffd700;">
                <p style="color: #ffd700; font-weight: bold; font-size: 16px;">📧 Quick Reply Actions</p>
                <p style="color: #e9d5ff; margin: 10px 0;">Reply to this email with ONE of these commands:</p>
                <ul style="color: #c4b5fd; list-style: none; padding-left: 0;">
                    <li style="margin: 8px 0;"><strong style="color: #10b981;">good</strong> or <strong style="color: #10b981;">okay</strong> - Dismiss flag, content is acceptable</li>
                    <li style="margin: 8px 0;"><strong style="color: #f59e0b;">bad</strong> - Issue warning to user (counts toward suspension)</li>
                    <li style="margin: 8px 0;"><strong style="color: #ef4444;">cancel</strong> - Immediately cancel user's account</li>
                </ul>
                <p style="color: #9f7aea; font-size: 12px; margin-top: 15px;">Just type the command in your reply - no other text needed.</p>
            </div>
            
            <div style="background-color: #2d1b4e; padding: 15px; border-radius: 8px; border: 1px solid #7c3aed;">
                <p style="color: #c4b5fd; font-size: 14px;">Or go to Settings → Admin Panel to manage this and other flags.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Also store the flag_id in database for reference
    await db.user_flags.update_one(
        {"_id": ObjectId(flag_id)},
        {"$set": {"email_sent": True, "email_sent_at": datetime.utcnow()}}
    )
    
    await send_email(ADMIN_EMAIL, subject, html_content)

async def send_user_warning(user_email: str, user_name: str, flag_count: int, reason: str):
    """Send warning to user about flagged content"""
    subject = "Etheria Community Guidelines Warning"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a0033; color: #e9d5ff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2d1b4e; padding: 30px; border-radius: 12px;">
            <h2 style="color: #f59e0b; margin-bottom: 20px;">⚠️ Community Guidelines Warning</h2>
            
            <p>Hello {user_name},</p>
            
            <p>Your recent content in the Etheria community has been flagged for violating our community guidelines.</p>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong style="color: #9f7aea;">Reason:</strong> {reason}</p>
                <p><strong style="color: #9f7aea;">Warning Count:</strong> {flag_count} of {FLAGS_BEFORE_SUSPENSION}</p>
            </div>
            
            <p style="color: #ef4444; font-weight: bold;">
                After {FLAGS_BEFORE_SUSPENSION} warnings, your account will be suspended for {FIRST_SUSPENSION_DAYS} days.
            </p>
            
            <p>Please review our community guidelines and ensure your future contributions align with our values of respect, kindness, and spiritual growth.</p>
            
            <p>If you believe this was a mistake, you may appeal by emailing <a href="mailto:{ADMIN_EMAIL}" style="color: #b794f6;">{ADMIN_EMAIL}</a></p>
            
            <p style="color: #9f7aea; margin-top: 30px;">Blessings,<br>The Etheria Team</p>
        </div>
    </body>
    </html>
    """
    
    await send_email(user_email, subject, html_content)

async def send_suspension_notice(
    user_email: str, 
    user_name: str, 
    suspension_days: int, 
    suspension_number: int,
    end_date: datetime
):
    """Send suspension notice to user"""
    subject = f"Etheria Account Suspended - {suspension_days} Days"
    
    suspension_text = "first" if suspension_number == 1 else "second"
    next_action = f"a {SECOND_SUSPENSION_DAYS}-day suspension" if suspension_number == 1 else "permanent account cancellation"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a0033; color: #e9d5ff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2d1b4e; padding: 30px; border-radius: 12px;">
            <h2 style="color: #ef4444; margin-bottom: 20px;">🚫 Account Suspended</h2>
            
            <p>Hello {user_name},</p>
            
            <p>Due to repeated violations of our community guidelines, your Etheria account has been suspended.</p>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong style="color: #9f7aea;">Suspension Duration:</strong> {suspension_days} days</p>
                <p><strong style="color: #9f7aea;">Suspension Type:</strong> {suspension_text.capitalize()} suspension</p>
                <p><strong style="color: #9f7aea;">Account Reactivates:</strong> {end_date.strftime('%B %d, %Y')}</p>
            </div>
            
            <p style="color: #f59e0b;">
                ⚠️ Please note: If violations continue after reactivation, your account will face {next_action}.
            </p>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #7c3aed;">
                <p style="color: #ffd700; font-weight: bold;">Appeal Process</p>
                <p>If you believe this suspension was made in error, you may appeal by emailing:</p>
                <p><a href="mailto:{ADMIN_EMAIL}?subject=Suspension Appeal - {user_email}" style="color: #b794f6; font-size: 18px;">{ADMIN_EMAIL}</a></p>
                <p style="font-size: 12px; color: #9f7aea;">Please include your email address and explain why you believe the suspension should be lifted.</p>
            </div>
            
            <p style="color: #9f7aea; margin-top: 30px;">The Etheria Team</p>
        </div>
    </body>
    </html>
    """
    
    await send_email(user_email, subject, html_content)

async def send_cancellation_notice(user_email: str, user_name: str, reason: str = "repeated violations"):
    """Send account cancellation notice to user"""
    subject = "Etheria Account Cancelled"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a0033; color: #e9d5ff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2d1b4e; padding: 30px; border-radius: 12px;">
            <h2 style="color: #ef4444; margin-bottom: 20px;">Account Cancelled</h2>
            
            <p>Hello {user_name},</p>
            
            <p>We regret to inform you that your Etheria account has been permanently cancelled due to {reason}.</p>
            
            <p>This decision was made after careful review of your account activity and multiple warnings.</p>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #7c3aed;">
                <p style="color: #ffd700; font-weight: bold;">Final Appeal</p>
                <p>If you wish to appeal this decision, you may contact:</p>
                <p><a href="mailto:{ADMIN_EMAIL}?subject=Account Cancellation Appeal - {user_email}" style="color: #b794f6;">{ADMIN_EMAIL}</a></p>
            </div>
            
            <p style="color: #9f7aea; margin-top: 30px;">The Etheria Team</p>
        </div>
    </body>
    </html>
    """
    
    await send_email(user_email, subject, html_content)

async def send_reactivation_notice(user_email: str, user_name: str):
    """Send account reactivation notice to user"""
    subject = "Etheria Account Reactivated"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a0033; color: #e9d5ff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2d1b4e; padding: 30px; border-radius: 12px;">
            <h2 style="color: #10b981; margin-bottom: 20px;">✨ Account Reactivated</h2>
            
            <p>Hello {user_name},</p>
            
            <p>Great news! Your Etheria account has been reactivated.</p>
            
            <p>We hope you'll continue to be a positive member of our spiritual community. Please remember to follow our community guidelines to avoid future issues.</p>
            
            <p>Welcome back! 🙏</p>
            
            <p style="color: #9f7aea; margin-top: 30px;">Blessings,<br>The Etheria Team</p>
        </div>
    </body>
    </html>
    """
    
    await send_email(user_email, subject, html_content)


async def send_reply_notification(
    to_email: str,
    to_name: str,
    replier_name: str,
    post_title: str,
    reply_content: str,
    post_id: str
):
    """Send notification to post author when someone replies to their post"""
    subject = f"New Reply to Your Post: {post_title[:50]}{'...' if len(post_title) > 50 else ''}"
    
    # Truncate reply preview
    reply_preview = reply_content[:200] + ('...' if len(reply_content) > 200 else '')
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #1a0033; color: #e9d5ff; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #2d1b4e; padding: 30px; border-radius: 12px;">
            <h2 style="color: #b794f6; margin-bottom: 20px;">💬 New Reply to Your Post</h2>
            
            <p style="color: #e9d5ff;">Hello {to_name},</p>
            
            <p style="color: #c4b5fd;"><strong>{replier_name}</strong> replied to your post:</p>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #7c3aed;">
                <p style="color: #9f7aea; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Your Post</p>
                <p style="color: #fff; font-weight: 600; margin: 0;">{post_title}</p>
            </div>
            
            <div style="background-color: #1a0033; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #10b981;">
                <p style="color: #9f7aea; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Reply from {replier_name}</p>
                <p style="color: #e9d5ff; font-style: italic; margin: 0;">"{reply_preview}"</p>
            </div>
            
            <p style="color: #c4b5fd; font-size: 14px;">
                Open the Etheria app to view and respond to this reply.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #3d2b5e;">
                <p style="color: #9f7aea; font-size: 12px; margin: 0;">
                    You're receiving this because someone replied to your post in the Etheria Community.
                </p>
            </div>
            
            <p style="color: #9f7aea; margin-top: 20px;">Blessings,<br>The Etheria Team ✨</p>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
Hello {to_name},

{replier_name} replied to your post "{post_title}":

"{reply_preview}"

Open the Etheria app to view and respond.

Blessings,
The Etheria Team
    """
    
    await send_email(to_email, subject, html_content, text_content)


async def process_flag(db, user_id: str, content_type: str, content: str, content_id: str, reason: str):
    """Process a flagged content item - increment user flags, apply suspensions if needed"""
    from bson import ObjectId
    
    # Get user
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"success": False, "error": "User not found"}
    
    user_email = user.get("email", "")
    user_name = user.get("display_name") or user.get("name") or user_email.split("@")[0]
    
    # Check if user is already permanently banned
    if user.get("account_status") == "cancelled":
        return {"success": True, "message": "User already banned", "action": "none"}
    
    # Check if user is currently suspended
    if user.get("account_status") == "suspended":
        suspension_end = user.get("suspension_end")
        if suspension_end and datetime.utcnow() < suspension_end:
            return {"success": True, "message": "User already suspended", "action": "none"}
        else:
            # Suspension ended, reactivate but keep flag count
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"account_status": "active"}}
            )
    
    # Increment flag count
    current_flags = user.get("flag_count", 0) + 1
    suspension_count = user.get("suspension_count", 0)
    
    # Create flag record
    flag_record = {
        "user_id": user_id,
        "content_type": content_type,
        "content_id": content_id,
        "content": content,
        "reason": reason,
        "created_at": datetime.utcnow(),
        "status": "pending"
    }
    flag_result = await db.user_flags.insert_one(flag_record)
    flag_id = str(flag_result.inserted_id)
    
    # Send admin notification
    await send_flagged_content_notification(
        db, user_id, user_email, user_name, content_type, content, reason, flag_id
    )
    
    # Delete flagged chat messages automatically
    if content_type == "chat":
        try:
            await db.community_chat.delete_one({"_id": ObjectId(content_id)})
        except:
            pass
    
    # Check if suspension is needed
    action_taken = "warning"
    
    if current_flags >= FLAGS_BEFORE_SUSPENSION:
        suspension_count += 1
        
        if suspension_count == 1:
            # First suspension - 2 weeks
            suspension_days = FIRST_SUSPENSION_DAYS
            suspension_end = datetime.utcnow() + timedelta(days=suspension_days)
            
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$set": {
                        "flag_count": 0,  # Reset for next cycle
                        "suspension_count": suspension_count,
                        "account_status": "suspended",
                        "suspension_start": datetime.utcnow(),
                        "suspension_end": suspension_end
                    }
                }
            )
            
            await send_suspension_notice(user_email, user_name, suspension_days, 1, suspension_end)
            action_taken = "suspended_14_days"
            
        elif suspension_count == 2:
            # Second suspension - 30 days
            suspension_days = SECOND_SUSPENSION_DAYS
            suspension_end = datetime.utcnow() + timedelta(days=suspension_days)
            
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$set": {
                        "flag_count": 0,
                        "suspension_count": suspension_count,
                        "account_status": "suspended",
                        "suspension_start": datetime.utcnow(),
                        "suspension_end": suspension_end
                    }
                }
            )
            
            await send_suspension_notice(user_email, user_name, suspension_days, 2, suspension_end)
            action_taken = "suspended_30_days"
            
        else:
            # Third+ offense - permanent ban
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$set": {
                        "account_status": "cancelled",
                        "cancelled_at": datetime.utcnow(),
                        "cancellation_reason": "repeated_violations"
                    }
                }
            )
            
            await send_cancellation_notice(user_email, user_name)
            action_taken = "cancelled"
    else:
        # Just a warning
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"flag_count": current_flags}}
        )
        
        await send_user_warning(user_email, user_name, current_flags, reason)
    
    return {
        "success": True,
        "action": action_taken,
        "flag_count": current_flags,
        "suspension_count": suspension_count
    }

async def check_user_can_post(db, user_id: str):
    """Check if user is allowed to post (not suspended or banned)"""
    from bson import ObjectId
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return False, "User not found"
    
    status = user.get("account_status", "active")
    
    if status == "cancelled":
        return False, "Your account has been cancelled due to community guideline violations."
    
    if status == "suspended":
        suspension_end = user.get("suspension_end")
        if suspension_end:
            if datetime.utcnow() < suspension_end:
                days_left = (suspension_end - datetime.utcnow()).days
                return False, f"Your account is suspended. {days_left} days remaining."
            else:
                # Auto-reactivate
                await db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"account_status": "active"}}
                )
                
                user_email = user.get("email", "")
                user_name = user.get("display_name") or user.get("name") or user_email.split("@")[0]
                await send_reactivation_notice(user_email, user_name)
                
                return True, "Account reactivated"
    
    return True, "OK"


# ============================================================================
# INBOUND EMAIL PROCESSING FOR ADMIN REPLY COMMANDS
# ============================================================================

def extract_flag_id_from_subject(subject: str) -> Optional[str]:
    """Extract flag ID from email subject like 'Re: Flagged for Review [FLAG:abc123]'"""
    # Match pattern [FLAG:xxxxxxx]
    match = re.search(r'\[FLAG:([a-f0-9]{24})\]', subject, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def extract_command_from_body(body: str) -> Optional[str]:
    """
    Extract moderation command from email body.
    Looks for: good, okay, bad, cancel (case-insensitive)
    Returns the first valid command found.
    """
    if not body:
        return None
    
    # Clean the body - get first line or first few words
    # Replies often have the command at the very beginning
    body_lower = body.lower().strip()
    
    # Remove common reply artifacts
    # Remove lines starting with > (quoted text)
    lines = body_lower.split('\n')
    clean_lines = []
    for line in lines:
        line = line.strip()
        # Skip quoted lines and signature lines
        if line.startswith('>') or line.startswith('--') or line.startswith('___'):
            continue
        # Skip empty lines
        if not line:
            continue
        clean_lines.append(line)
    
    if not clean_lines:
        return None
    
    # Check first few lines for a command
    text_to_check = ' '.join(clean_lines[:3])
    
    # Look for exact command words
    for cmd in VALID_COMMANDS.keys():
        # Match the command as a whole word
        pattern = rf'\b{cmd}\b'
        if re.search(pattern, text_to_check):
            return cmd
    
    return None


def decode_email_body(msg) -> str:
    """Extract and decode the text body from an email message"""
    body = ""
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            
            # Skip attachments
            if "attachment" in content_disposition:
                continue
            
            # Prefer plain text
            if content_type == "text/plain":
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or 'utf-8'
                    body = payload.decode(charset, errors='replace')
                    break  # Use plain text if available
                except Exception as e:
                    print(f"Error decoding email part: {e}")
                    continue
            # Fall back to HTML if no plain text
            elif content_type == "text/html" and not body:
                try:
                    payload = part.get_payload(decode=True)
                    charset = part.get_content_charset() or 'utf-8'
                    html_body = payload.decode(charset, errors='replace')
                    # Simple HTML stripping
                    body = re.sub(r'<[^>]+>', ' ', html_body)
                    body = re.sub(r'\s+', ' ', body).strip()
                except Exception as e:
                    print(f"Error decoding HTML part: {e}")
                    continue
    else:
        try:
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or 'utf-8'
            body = payload.decode(charset, errors='replace')
        except Exception as e:
            print(f"Error decoding email body: {e}")
    
    return body


def check_admin_inbox_for_replies() -> list:
    """
    Connect to Gmail IMAP and check for replies to flagged content emails.
    Returns a list of (flag_id, command, email_uid) tuples for processing.
    
    Note: This is a synchronous function that should be called from an async context.
    """
    if not GMAIL_APP_PASSWORD:
        print("[Moderation] IMAP: No Gmail password configured, skipping inbox check")
        return []
    
    results = []
    
    try:
        # Connect to Gmail IMAP
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(GMAIL_EMAIL, GMAIL_APP_PASSWORD)
        
        # Select inbox
        mail.select('INBOX')
        
        # Search for unread emails with "FLAG:" in subject (our reply format)
        # Note: IMAP search might vary, we search for UNSEEN emails
        status, messages = mail.search(None, 'UNSEEN')
        
        if status != 'OK':
            print("[Moderation] IMAP: Failed to search inbox")
            mail.logout()
            return []
        
        email_ids = messages[0].split()
        print(f"[Moderation] IMAP: Found {len(email_ids)} unread emails")
        
        for email_id in email_ids:
            try:
                # Fetch the email
                status, msg_data = mail.fetch(email_id, '(RFC822)')
                if status != 'OK':
                    continue
                
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                # Decode subject
                subject_header = msg.get('Subject', '')
                decoded_subject = ''
                for part, encoding in decode_header(subject_header):
                    if isinstance(part, bytes):
                        decoded_subject += part.decode(encoding or 'utf-8', errors='replace')
                    else:
                        decoded_subject += part
                
                # Check if this is a reply to a flagged content email
                flag_id = extract_flag_id_from_subject(decoded_subject)
                if not flag_id:
                    continue
                
                print(f"[Moderation] IMAP: Found reply for flag {flag_id}")
                
                # Extract and parse the body
                body = decode_email_body(msg)
                command = extract_command_from_body(body)
                
                if command:
                    print(f"[Moderation] IMAP: Extracted command '{command}' for flag {flag_id}")
                    results.append((flag_id, command, email_id.decode()))
                    
                    # Mark as read (seen)
                    mail.store(email_id, '+FLAGS', '\\Seen')
                else:
                    print(f"[Moderation] IMAP: No valid command found in reply for flag {flag_id}")
                    # Still mark as seen to avoid reprocessing
                    mail.store(email_id, '+FLAGS', '\\Seen')
                    
            except Exception as e:
                print(f"[Moderation] IMAP: Error processing email {email_id}: {e}")
                continue
        
        mail.logout()
        
    except Exception as e:
        print(f"[Moderation] IMAP: Error connecting to inbox: {e}")
    
    return results


async def execute_moderation_command(db, flag_id: str, command: str) -> Dict[str, Any]:
    """
    Execute a moderation action based on email reply command.
    
    Commands:
    - good/okay: Dismiss the flag, content is acceptable
    - bad: Issue a warning to the user (counts toward suspension)
    - cancel: Immediately cancel the user's account
    """
    action = VALID_COMMANDS.get(command)
    if not action:
        return {"success": False, "error": f"Unknown command: {command}"}
    
    # Get the flag record
    try:
        flag = await db.user_flags.find_one({"_id": ObjectId(flag_id)})
    except:
        return {"success": False, "error": f"Invalid flag ID: {flag_id}"}
    
    if not flag:
        return {"success": False, "error": f"Flag not found: {flag_id}"}
    
    # Check if already processed
    if flag.get("status") == "processed":
        return {"success": True, "message": "Flag already processed", "action": "none"}
    
    user_id = flag.get("user_id")
    if not user_id:
        return {"success": False, "error": "No user_id in flag record"}
    
    # Get user
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await db.users.find_one({"user_id": user_id})
    
    if not user:
        return {"success": False, "error": f"User not found: {user_id}"}
    
    user_email = user.get("email", "")
    user_name = user.get("display_name") or user.get("name") or user_email.split("@")[0]
    result = {"success": True, "action": action, "flag_id": flag_id}
    
    if action == "approve":
        # Dismiss the flag - content is acceptable
        await db.user_flags.update_one(
            {"_id": ObjectId(flag_id)},
            {
                "$set": {
                    "status": "processed",
                    "resolution": "approved",
                    "processed_at": datetime.utcnow(),
                    "processed_via": "email_reply"
                }
            }
        )
        result["message"] = f"Flag dismissed for user {user_email}"
        print(f"[Moderation] Approved/dismissed flag {flag_id} for user {user_email}")
        
    elif action == "warn":
        # Issue a warning to the user
        current_flags = user.get("flag_count", 0) + 1
        suspension_count = user.get("suspension_count", 0)
        
        # Update flag status
        await db.user_flags.update_one(
            {"_id": ObjectId(flag_id)},
            {
                "$set": {
                    "status": "processed",
                    "resolution": "warning_issued",
                    "processed_at": datetime.utcnow(),
                    "processed_via": "email_reply"
                }
            }
        )
        
        # Check if this triggers suspension
        if current_flags >= FLAGS_BEFORE_SUSPENSION:
            suspension_count += 1
            
            if suspension_count == 1:
                # First suspension
                suspension_end = datetime.utcnow() + timedelta(days=FIRST_SUSPENSION_DAYS)
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "flag_count": 0,
                            "suspension_count": suspension_count,
                            "account_status": "suspended",
                            "suspension_start": datetime.utcnow(),
                            "suspension_end": suspension_end
                        }
                    }
                )
                await send_suspension_notice(user_email, user_name, FIRST_SUSPENSION_DAYS, 1, suspension_end)
                result["message"] = f"User {user_email} suspended for {FIRST_SUSPENSION_DAYS} days (first suspension)"
                
            elif suspension_count == 2:
                # Second suspension
                suspension_end = datetime.utcnow() + timedelta(days=SECOND_SUSPENSION_DAYS)
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "flag_count": 0,
                            "suspension_count": suspension_count,
                            "account_status": "suspended",
                            "suspension_start": datetime.utcnow(),
                            "suspension_end": suspension_end
                        }
                    }
                )
                await send_suspension_notice(user_email, user_name, SECOND_SUSPENSION_DAYS, 2, suspension_end)
                result["message"] = f"User {user_email} suspended for {SECOND_SUSPENSION_DAYS} days (second suspension)"
                
            else:
                # Third+ offense - permanent ban
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "account_status": "cancelled",
                            "cancelled_at": datetime.utcnow(),
                            "cancellation_reason": "repeated_violations"
                        }
                    }
                )
                await send_cancellation_notice(user_email, user_name)
                result["message"] = f"User {user_email} account cancelled (third+ offense)"
        else:
            # Just a warning
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"flag_count": current_flags}}
            )
            await send_user_warning(user_email, user_name, current_flags, flag.get("reason", "Community guidelines violation"))
            result["message"] = f"Warning issued to {user_email} ({current_flags}/{FLAGS_BEFORE_SUSPENSION})"
        
        print(f"[Moderation] Warning/action taken for flag {flag_id}: {result.get('message')}")
        
    elif action == "cancel":
        # Immediately cancel the user's account
        await db.user_flags.update_one(
            {"_id": ObjectId(flag_id)},
            {
                "$set": {
                    "status": "processed",
                    "resolution": "account_cancelled",
                    "processed_at": datetime.utcnow(),
                    "processed_via": "email_reply"
                }
            }
        )
        
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "account_status": "cancelled",
                    "cancelled_at": datetime.utcnow(),
                    "cancellation_reason": "admin_decision"
                }
            }
        )
        
        await send_cancellation_notice(user_email, user_name, reason="violation of community guidelines")
        result["message"] = f"User {user_email} account cancelled by admin command"
        print(f"[Moderation] Account cancelled for flag {flag_id}: {user_email}")
    
    return result


async def process_inbound_moderation_emails(db) -> Dict[str, Any]:
    """
    Main function to check inbox and process any admin reply commands.
    This should be called periodically (e.g., every 5 minutes) by a background task.
    
    Returns summary of actions taken.
    """
    print("[Moderation] Starting inbound email check...")
    
    # Run the synchronous IMAP check in a thread pool
    loop = asyncio.get_event_loop()
    replies = await loop.run_in_executor(None, check_admin_inbox_for_replies)
    
    if not replies:
        print("[Moderation] No moderation replies found")
        return {"processed": 0, "actions": []}
    
    actions = []
    for flag_id, command, email_uid in replies:
        result = await execute_moderation_command(db, flag_id, command)
        actions.append({
            "flag_id": flag_id,
            "command": command,
            "result": result
        })
    
    print(f"[Moderation] Processed {len(actions)} email replies")
    return {"processed": len(actions), "actions": actions}


# Background task reference (will be set by server.py)
_email_check_task = None


async def start_email_polling_task(db, interval_seconds: int = 300):
    """
    Start a background task that periodically checks for admin email replies.
    Default interval: 5 minutes (300 seconds)
    """
    global _email_check_task
    
    async def poll_loop():
        while True:
            try:
                await process_inbound_moderation_emails(db)
            except Exception as e:
                print(f"[Moderation] Error in email polling task: {e}")
            await asyncio.sleep(interval_seconds)
    
    _email_check_task = asyncio.create_task(poll_loop())
    print(f"[Moderation] Started email polling task (interval: {interval_seconds}s)")
    return _email_check_task


def stop_email_polling_task():
    """Stop the background email polling task"""
    global _email_check_task
    if _email_check_task:
        _email_check_task.cancel()
        _email_check_task = None
        print("[Moderation] Stopped email polling task")
