"""
Community Routes - AI Moderated Message Board and Chat
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
import os
import re
import uuid
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from emergentintegrations.llm.chat import LlmChat
from services.moderation_service import process_flag, check_user_can_post

router = APIRouter(prefix="/api/community", tags=["community"])

# Will be set by server.py
db = None
llm_api_key = None

def set_db(database):
    global db
    db = database

def set_llm_key(key):
    global llm_api_key
    llm_api_key = key

# Check if user has agreed to community guidelines
@router.get("/guidelines-agreement")
async def check_guidelines_agreement(token: Optional[str] = None):
    """Check if user has agreed to community guidelines"""
    user = await get_user_from_token(token)
    if not user:
        return {"agreed": False, "requires_auth": True}
    
    # Check if user has agreed
    agreement = await db.community_guidelines_agreements.find_one({
        "user_id": user.get("user_id")
    })
    
    return {
        "agreed": agreement is not None,
        "agreed_at": agreement.get("agreed_at").isoformat() if agreement and agreement.get("agreed_at") else None
    }

@router.post("/guidelines-agreement")
async def agree_to_guidelines(token: Optional[str] = None):
    """Record user's agreement to community guidelines"""
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get("user_id")
    
    # Check if already agreed
    existing = await db.community_guidelines_agreements.find_one({"user_id": user_id})
    if existing:
        return {"success": True, "message": "Already agreed to guidelines"}
    
    # Record agreement
    await db.community_guidelines_agreements.insert_one({
        "user_id": user_id,
        "email": user.get("email"),
        "agreed_at": datetime.utcnow(),
        "version": "1.0"  # Can be used to re-prompt on guideline updates
    })
    
    return {"success": True, "message": "Thank you for agreeing to our community guidelines"}

# Categories for the community
CATEGORIES = [
    {
        "id": "meditation",
        "name": "Meditation & Mindfulness",
        "description": "Share your meditation experiences and tips",
        "icon": "leaf",
        "color": "#10b981"
    },
    {
        "id": "dreams",
        "name": "Dream Interpretation",
        "description": "Discuss and interpret dreams together",
        "icon": "moon",
        "color": "#8b5cf6"
    },
    {
        "id": "oracle",
        "name": "Oracle & Divination",
        "description": "Share readings and seek guidance",
        "icon": "eye",
        "color": "#f59e0b"
    },
    {
        "id": "spirit-guides",
        "name": "Spirit Guides",
        "description": "Connect with others about spiritual guidance",
        "icon": "sparkles",
        "color": "#ec4899"
    },
    {
        "id": "general",
        "name": "General Discussion",
        "description": "Open discussions about spirituality",
        "icon": "chatbubbles",
        "color": "#6366f1"
    }
]

# Pydantic Models
class PostCreate(BaseModel):
    category: str
    title: str
    content: str

class CommentCreate(BaseModel):
    content: str

class ChatMessage(BaseModel):
    room: str
    message: str

class ModerationResult(BaseModel):
    approved: bool
    flagged: bool
    reason: Optional[str] = None
    filtered_content: Optional[str] = None

# AI Moderation Function
async def moderate_content(content: str, content_type: str = "message") -> ModerationResult:
    """Use AI to moderate content for inappropriate material"""
    
    if not llm_api_key:
        # Fallback: basic keyword filtering if LLM not available
        inappropriate_keywords = [
            'hate', 'kill', 'violence', 'racist', 'sexist', 
            'spam', 'scam', 'http://', 'https://', 'www.'
        ]
        content_lower = content.lower()
        for keyword in inappropriate_keywords:
            if keyword in content_lower:
                return ModerationResult(
                    approved=False,
                    flagged=True,
                    reason=f"Content contains potentially inappropriate material"
                )
        return ModerationResult(approved=True, flagged=False)
    
    try:
        moderation_prompt = f"""You are a content moderator for a spiritual wellness community app. 
Analyze the following {content_type} and determine if it's appropriate.

Content to moderate:
"{content}"

Rules:
1. Block explicit sexual content, hate speech, violence, harassment
2. Block spam, advertisements, or promotional content
3. Block sharing of personal contact info (phone numbers, addresses)
4. Allow spiritual discussions, even if unconventional
5. Allow honest questions and seeking guidance
6. Be lenient with spiritual/metaphysical topics

Respond in this exact format:
APPROVED: [yes/no]
FLAGGED: [yes/no]
REASON: [brief reason if not approved or flagged]

If flagged but approved, it means human review is recommended but content can be posted."""

        # Create LlmChat instance for moderation
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"moderation-{uuid.uuid4()}",
            system_message="You are a content moderator for a spiritual wellness community."
        )
        
        response = await chat.chat(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": moderation_prompt}]
        )
        
        response_text = response.get("message", "").upper()
        
        approved = "APPROVED: YES" in response_text
        flagged = "FLAGGED: YES" in response_text
        
        # Extract reason if present
        reason = None
        if "REASON:" in response_text:
            reason_match = re.search(r'REASON:\s*(.+?)(?:\n|$)', response_text, re.IGNORECASE)
            if reason_match:
                reason = reason_match.group(1).strip()
        
        return ModerationResult(
            approved=approved,
            flagged=flagged,
            reason=reason
        )
        
    except Exception as e:
        print(f"Moderation error: {e}")
        # Default to approved but flagged for review on error
        return ModerationResult(approved=True, flagged=True, reason="Auto-flagged for review")

# Helper to check premium status
async def get_user_from_token(token: str):
    """Get user from auth token or session token"""
    if not token:
        return None
    
    # First try direct auth_token on user
    user = await db.users.find_one({"auth_token": token})
    if user:
        return user
    
    # Fallback: try session_token in user_sessions collection
    session = await db.user_sessions.find_one({"session_token": token})
    if session:
        user = await db.users.find_one({"user_id": session["user_id"]})
        return user
    
    return None

async def check_premium(token: str) -> bool:
    """Check if user has premium access"""
    user = await get_user_from_token(token)
    if not user:
        return False
    
    subscription = await db.subscriptions.find_one({"user_id": str(user["_id"])})
    if subscription and subscription.get("status") == "active":
        return True
    
    # Check for lifetime premium
    if user.get("lifetime_premium"):
        return True
        
    return False

# Routes
@router.get("/categories")
async def get_categories():
    """Get all community categories"""
    return {"categories": CATEGORIES}

@router.get("/posts/{category}")
async def get_posts(category: str, token: Optional[str] = None, limit: int = 50, skip: int = 0):
    """Get posts in a category"""
    
    # Check premium access
    if not await check_premium(token):
        raise HTTPException(status_code=403, detail="Premium subscription required for community access")
    
    if category not in [c["id"] for c in CATEGORIES]:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    posts = await db.community_posts.find(
        {"category": category, "approved": True}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Format posts
    formatted_posts = []
    for post in posts:
        # Get comment count
        comment_count = await db.community_comments.count_documents({"post_id": str(post["_id"])})
        
        # Check if author is admin
        author_is_admin = False
        if post.get("author_id"):
            author = await db.users.find_one({"_id": ObjectId(post["author_id"])})
            if author and author.get("is_admin"):
                author_is_admin = True
        
        formatted_posts.append({
            "id": str(post["_id"]),
            "title": post["title"],
            "content": post["content"],
            "author_name": post.get("author_name", "Anonymous"),
            "author_id": post.get("author_id"),
            "is_admin": author_is_admin,
            "category": post["category"],
            "created_at": post["created_at"].isoformat() if post.get("created_at") else None,
            "comment_count": comment_count,
            "likes": post.get("likes", 0)
        })
    
    return {"posts": formatted_posts}

@router.post("/posts")
async def create_post(post: PostCreate, token: Optional[str] = None):
    """Create a new post"""
    
    if not await check_premium(token):
        raise HTTPException(status_code=403, detail="Premium subscription required for community access")
    
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if user can post (not suspended/banned)
    can_post, message = await check_user_can_post(db, str(user["_id"]))
    if not can_post:
        raise HTTPException(status_code=403, detail=message)
    
    if post.category not in [c["id"] for c in CATEGORIES]:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    if len(post.title.strip()) < 3:
        raise HTTPException(status_code=400, detail="Title must be at least 3 characters")
    
    if len(post.content.strip()) < 10:
        raise HTTPException(status_code=400, detail="Content must be at least 10 characters")
    
    # Moderate content
    title_moderation = await moderate_content(post.title, "title")
    content_moderation = await moderate_content(post.content, "post")
    
    approved = title_moderation.approved and content_moderation.approved
    flagged = title_moderation.flagged or content_moderation.flagged
    
    if not approved:
        reason = title_moderation.reason or content_moderation.reason
        # Process the flag - this will send emails, track flags, and potentially suspend
        await process_flag(
            db, 
            str(user["_id"]), 
            "post", 
            post.content, 
            "rejected", 
            reason or "Content violates community guidelines"
        )
        raise HTTPException(status_code=400, detail=f"Post not approved: {reason}")
    
    # Create post
    post_doc = {
        "category": post.category,
        "title": post.title.strip(),
        "content": post.content.strip(),
        "author_id": str(user["_id"]),
        "author_name": user.get("display_name") or user.get("name") or user.get("email", "").split("@")[0],
        "created_at": datetime.utcnow(),
        "approved": True,
        "flagged": flagged,
        "likes": 0
    }
    
    result = await db.community_posts.insert_one(post_doc)
    
    # If flagged, process the flag (sends email, tracks warnings)
    if flagged:
        await process_flag(
            db,
            str(user["_id"]),
            "post",
            post.content,
            str(result.inserted_id),
            title_moderation.reason or content_moderation.reason or "Flagged for review"
        )
    
    return {
        "success": True,
        "post_id": str(result.inserted_id),
        "flagged": flagged,
        "message": "Post created successfully" + (" (flagged for review)" if flagged else "")
    }

@router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str, token: Optional[str] = None, limit: int = 100):
    """Get comments for a post"""
    
    if not await check_premium(token):
        raise HTTPException(status_code=403, detail="Premium subscription required for community access")
    
    try:
        post = await db.community_posts.find_one({"_id": ObjectId(post_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comments = await db.community_comments.find(
        {"post_id": post_id, "approved": True}
    ).sort("created_at", 1).limit(limit).to_list(length=limit)
    
    formatted_comments = []
    for comment in comments:
        # Check if author is admin
        author_is_admin = False
        if comment.get("author_id"):
            author = await db.users.find_one({"_id": ObjectId(comment["author_id"])})
            if author and author.get("is_admin"):
                author_is_admin = True
        
        formatted_comments.append({
            "id": str(comment["_id"]),
            "content": comment["content"],
            "author_name": comment.get("author_name", "Anonymous"),
            "author_id": comment.get("author_id"),
            "is_admin": author_is_admin,
            "created_at": comment["created_at"].isoformat() if comment.get("created_at") else None,
            "likes": comment.get("likes", 0)
        })
    
    return {"comments": formatted_comments}

@router.post("/posts/{post_id}/comments")
async def create_comment(post_id: str, comment: CommentCreate, token: Optional[str] = None):
    """Add a comment to a post"""
    
    if not await check_premium(token):
        raise HTTPException(status_code=403, detail="Premium subscription required for community access")
    
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if user can post (not suspended/banned)
    can_post, message = await check_user_can_post(db, str(user["_id"]))
    if not can_post:
        raise HTTPException(status_code=403, detail=message)
    
    try:
        post = await db.community_posts.find_one({"_id": ObjectId(post_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if len(comment.content.strip()) < 2:
        raise HTTPException(status_code=400, detail="Comment must be at least 2 characters")
    
    # Moderate content
    moderation = await moderate_content(comment.content, "comment")
    
    if not moderation.approved:
        # Process flag for rejected comment
        await process_flag(
            db,
            str(user["_id"]),
            "comment",
            comment.content,
            "rejected",
            moderation.reason or "Comment violates community guidelines"
        )
        raise HTTPException(status_code=400, detail=f"Comment not approved: {moderation.reason}")
    
    comment_doc = {
        "post_id": post_id,
        "content": comment.content.strip(),
        "author_id": str(user["_id"]),
        "author_name": user.get("display_name") or user.get("name") or user.get("email", "").split("@")[0],
        "created_at": datetime.utcnow(),
        "approved": True,
        "flagged": moderation.flagged,
        "likes": 0
    }
    
    result = await db.community_comments.insert_one(comment_doc)
    
    if moderation.flagged:
        await process_flag(
            db,
            str(user["_id"]),
            "comment",
            comment.content,
            str(result.inserted_id),
            moderation.reason or "Flagged for review"
        )
    
    return {
        "success": True,
        "comment_id": str(result.inserted_id),
        "message": "Comment added successfully"
    }

@router.post("/posts/{post_id}/like")
async def like_post(post_id: str, token: Optional[str] = None):
    """Like a post"""
    
    if not await check_premium(token):
        raise HTTPException(status_code=403, detail="Premium subscription required")
    
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        post = await db.community_posts.find_one({"_id": ObjectId(post_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already liked
    existing_like = await db.community_likes.find_one({
        "post_id": post_id,
        "user_id": str(user["_id"])
    })
    
    if existing_like:
        # Unlike
        await db.community_likes.delete_one({"_id": existing_like["_id"]})
        await db.community_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"likes": -1}}
        )
        return {"success": True, "action": "unliked"}
    else:
        # Like
        await db.community_likes.insert_one({
            "post_id": post_id,
            "user_id": str(user["_id"]),
            "created_at": datetime.utcnow()
        })
        await db.community_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"likes": 1}}
        )
        return {"success": True, "action": "liked"}

# Chat Room Routes
@router.get("/chat/{room}")
async def get_chat_messages(room: str, token: Optional[str] = None, limit: int = 100):
    """Get chat messages for a room"""
    
    if not await check_premium(token):
        raise HTTPException(status_code=403, detail="Premium subscription required for community access")
    
    if room not in [c["id"] for c in CATEGORIES]:
        raise HTTPException(status_code=400, detail="Invalid chat room")
    
    messages = await db.community_chat.find(
        {"room": room, "approved": True}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    # Reverse to show oldest first
    messages.reverse()
    
    formatted_messages = []
    for msg in messages:
        # Check if author is admin
        author_is_admin = False
        if msg.get("author_id"):
            author = await db.users.find_one({"_id": ObjectId(msg["author_id"])})
            if author and author.get("is_admin"):
                author_is_admin = True
        
        formatted_messages.append({
            "id": str(msg["_id"]),
            "message": msg["message"],
            "author_name": msg.get("author_name", "Anonymous"),
            "author_id": msg.get("author_id"),
            "is_admin": author_is_admin,
            "created_at": msg["created_at"].isoformat() if msg.get("created_at") else None
        })
    
    return {"messages": formatted_messages, "room": room}

@router.post("/chat/{room}")
async def send_chat_message(room: str, chat: ChatMessage, token: Optional[str] = None):
    """Send a chat message"""
    
    if not await check_premium(token):
        raise HTTPException(status_code=403, detail="Premium subscription required for community access")
    
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if user can post (not suspended/banned)
    can_post, message = await check_user_can_post(db, str(user["_id"]))
    if not can_post:
        raise HTTPException(status_code=403, detail=message)
    
    if room not in [c["id"] for c in CATEGORIES]:
        raise HTTPException(status_code=400, detail="Invalid chat room")
    
    if len(chat.message.strip()) < 1:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    if len(chat.message) > 500:
        raise HTTPException(status_code=400, detail="Message too long (max 500 characters)")
    
    # Moderate content
    moderation = await moderate_content(chat.message, "chat message")
    
    if not moderation.approved:
        # Process flag for rejected chat - this will auto-delete
        await process_flag(
            db,
            str(user["_id"]),
            "chat",
            chat.message,
            "rejected",
            moderation.reason or "Message violates community guidelines"
        )
        raise HTTPException(status_code=400, detail=f"Message not approved: {moderation.reason}")
    
    message_doc = {
        "room": room,
        "message": chat.message.strip(),
        "author_id": str(user["_id"]),
        "author_name": user.get("display_name") or user.get("name") or user.get("email", "").split("@")[0],
        "created_at": datetime.utcnow(),
        "approved": True,
        "flagged": moderation.flagged
    }
    
    result = await db.community_chat.insert_one(message_doc)
    
    # If flagged, process and auto-delete chat message
    if moderation.flagged:
        await process_flag(
            db,
            str(user["_id"]),
            "chat",
            chat.message,
            str(result.inserted_id),
            moderation.reason or "Flagged for review"
        )
        # Note: process_flag automatically deletes flagged chat messages
    
    return {
        "success": True,
        "message_id": str(result.inserted_id),
        "created_at": message_doc["created_at"].isoformat()
    }

# User Flag Routes
@router.post("/flag/{content_type}/{content_id}")
async def flag_content_for_review(
    content_type: str, 
    content_id: str, 
    reason: Optional[str] = None,
    token: Optional[str] = None
):
    """User-initiated flag for AI moderation review"""
    from services.moderation_service import process_flag
    
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if content_type not in ["post", "comment", "chat"]:
        raise HTTPException(status_code=400, detail="Invalid content type")
    
    # Get the content
    content_text = ""
    author_id = ""
    title = None
    
    try:
        if content_type == "post":
            content = await db.community_posts.find_one({"_id": ObjectId(content_id)})
            if content:
                content_text = content.get("content", "")
                author_id = content.get("author_id", "")
                title = content.get("title")
        elif content_type == "comment":
            content = await db.community_comments.find_one({"_id": ObjectId(content_id)})
            if content:
                content_text = content.get("content", "")
                author_id = content.get("author_id", "")
        elif content_type == "chat":
            content = await db.community_chat.find_one({"_id": ObjectId(content_id)})
            if content:
                content_text = content.get("message", "")
                author_id = content.get("author_id", "")
    except:
        raise HTTPException(status_code=400, detail="Invalid content ID")
    
    if not content_text:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Prevent self-flagging
    if author_id == user.get("user_id"):
        raise HTTPException(status_code=400, detail="You cannot flag your own content")
    
    # Check if already flagged by this user
    existing_flag = await db.user_content_flags.find_one({
        "content_id": content_id,
        "flagged_by": user.get("user_id")
    })
    
    if existing_flag:
        raise HTTPException(status_code=400, detail="You have already flagged this content")
    
    # Record user flag
    await db.user_content_flags.insert_one({
        "content_type": content_type,
        "content_id": content_id,
        "flagged_by": user.get("user_id"),
        "reason": reason or "User reported for review",
        "created_at": datetime.utcnow()
    })
    
    # Process through AI moderator
    flag_reason = reason or "User-reported content for review"
    await process_flag(
        author_id,
        content_type,
        content_text,
        content_id,
        f"USER_REPORTED: {flag_reason}"
    )
    
    return {
        "success": True,
        "message": "Content has been flagged and sent for review. Thank you for helping keep our community safe."
    }

# Admin Routes for reviewing flagged content
@router.get("/admin/flagged")
async def get_flagged_content(token: Optional[str] = None, limit: int = 50):
    """Get flagged content for admin review"""
    
    user = await get_user_from_token(token)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    flagged = await db.flagged_content.find(
        {"reviewed": False}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    formatted = []
    for item in flagged:
        formatted.append({
            "id": str(item["_id"]),
            "content_type": item["content_type"],
            "content_id": item["content_id"],
            "content": item["content"],
            "title": item.get("title"),
            "author_id": item["author_id"],
            "reason": item.get("reason"),
            "created_at": item["created_at"].isoformat() if item.get("created_at") else None
        })
    
    return {"flagged_content": formatted}

@router.post("/admin/review/{flagged_id}")
async def review_flagged_content(flagged_id: str, action: str, token: Optional[str] = None):
    """Review and take action on flagged content"""
    
    user = await get_user_from_token(token)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if action not in ["approve", "remove"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'remove'")
    
    try:
        flagged = await db.flagged_content.find_one({"_id": ObjectId(flagged_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid flagged content ID")
    
    if not flagged:
        raise HTTPException(status_code=404, detail="Flagged content not found")
    
    if action == "remove":
        # Remove the content
        content_type = flagged["content_type"]
        content_id = flagged["content_id"]
        
        if content_type == "post":
            await db.community_posts.delete_one({"_id": ObjectId(content_id)})
            await db.community_comments.delete_many({"post_id": content_id})
        elif content_type == "comment":
            await db.community_comments.delete_one({"_id": ObjectId(content_id)})
        elif content_type == "chat":
            await db.community_chat.delete_one({"_id": ObjectId(content_id)})
    
    # Mark as reviewed
    await db.flagged_content.update_one(
        {"_id": ObjectId(flagged_id)},
        {"$set": {"reviewed": True, "action": action, "reviewed_by": str(user["_id"]), "reviewed_at": datetime.utcnow()}}
    )
    
    return {"success": True, "action": action}

@router.get("/admin/flagged-users")
async def get_flagged_users(token: Optional[str] = None, limit: int = 50):
    """Get users with flags or suspensions"""
    from services.moderation_service import send_reactivation_notice, send_cancellation_notice
    
    user = await get_user_from_token(token)
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get users with flags, suspensions, or cancellations
    users = await db.users.find({
        "$or": [
            {"flag_count": {"$gt": 0}},
            {"account_status": {"$in": ["suspended", "cancelled"]}},
            {"suspension_count": {"$gt": 0}}
        ]
    }).limit(limit).to_list(length=limit)
    
    formatted = []
    for u in users:
        formatted.append({
            "id": str(u["_id"]),
            "email": u.get("email", ""),
            "name": u.get("display_name") or u.get("name", ""),
            "flag_count": u.get("flag_count", 0),
            "suspension_count": u.get("suspension_count", 0),
            "account_status": u.get("account_status", "active"),
            "suspension_end": u.get("suspension_end").isoformat() if u.get("suspension_end") and hasattr(u.get("suspension_end"), 'isoformat') else str(u.get("suspension_end")) if u.get("suspension_end") else None,
            "created_at": u.get("created_at").isoformat() if u.get("created_at") and hasattr(u.get("created_at"), 'isoformat') else str(u.get("created_at")) if u.get("created_at") else None
        })
    
    return {"users": formatted}

@router.post("/admin/user/{user_id}/action")
async def admin_user_action(user_id: str, action: str, token: Optional[str] = None):
    """Admin actions on users: reactivate, cancel, clear_flags"""
    from services.moderation_service import send_reactivation_notice, send_cancellation_notice
    
    admin = await get_user_from_token(token)
    if not admin or not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if action not in ["reactivate", "cancel", "clear_flags"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'reactivate', 'cancel', or 'clear_flags'")
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_email = user.get("email", "")
    user_name = user.get("display_name") or user.get("name") or user_email.split("@")[0]
    
    if action == "reactivate":
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "account_status": "active",
                    "flag_count": 0
                },
                "$unset": {
                    "suspension_start": "",
                    "suspension_end": ""
                }
            }
        )
        await send_reactivation_notice(user_email, user_name)
        return {"success": True, "message": f"User {user_email} reactivated"}
    
    elif action == "cancel":
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "account_status": "cancelled",
                    "cancelled_at": datetime.utcnow(),
                    "cancellation_reason": "admin_action"
                }
            }
        )
        await send_cancellation_notice(user_email, user_name, "admin decision")
        return {"success": True, "message": f"User {user_email} cancelled"}
    
    elif action == "clear_flags":
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "flag_count": 0
                }
            }
        )
        return {"success": True, "message": f"Flags cleared for {user_email}"}

@router.get("/admin/user-flags/{user_id}")
async def get_user_flags(user_id: str, token: Optional[str] = None):
    """Get all flags for a specific user"""
    
    admin = await get_user_from_token(token)
    if not admin or not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    flags = await db.user_flags.find(
        {"user_id": user_id}
    ).sort("created_at", -1).to_list(length=100)
    
    formatted = []
    for f in flags:
        formatted.append({
            "id": str(f["_id"]),
            "content_type": f.get("content_type"),
            "content": f.get("content"),
            "reason": f.get("reason"),
            "status": f.get("status", "pending"),
            "created_at": f.get("created_at").isoformat() if f.get("created_at") else None
        })
    
    return {"flags": formatted}



@router.get("/admin/all-users")
async def get_all_users(token: Optional[str] = None, limit: int = 100, skip: int = 0, search: Optional[str] = None):
    """Get all users for admin management"""
    
    admin = await get_user_from_token(token)
    if not admin or not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Build query
        query = {}
        if search:
            query = {
                "$or": [
                    {"email": {"$regex": search, "$options": "i"}},
                    {"name": {"$regex": search, "$options": "i"}},
                    {"display_name": {"$regex": search, "$options": "i"}}
                ]
            }
        
        # Get users - sorted by created_at descending (newest first)
        users = await db.users.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        total_users = await db.users.count_documents(query)
        
        # Log for debugging
        print(f"[Admin Panel] Found {len(users)} users, total: {total_users}")
        
        formatted = []
        for u in users:
            # Get subscription status
            subscription = await db.subscriptions.find_one({"user_id": u.get("user_id")})
            is_premium = (subscription and subscription.get("status") == "active") or u.get("lifetime_premium", False)
            
            # Handle created_at which might be datetime or string
            created_at = u.get("created_at")
            if created_at:
                if hasattr(created_at, 'isoformat'):
                    created_at = created_at.isoformat()
                # else it's already a string
            else:
                created_at = None
            
            formatted.append({
                "id": str(u["_id"]),
                "user_id": u.get("user_id"),
                "email": u.get("email", ""),
                "name": u.get("display_name") or u.get("name", ""),
                "is_admin": u.get("is_admin", False),
                "admin_level": u.get("admin_level", 0),
                "is_premium": is_premium,
                "is_lifetime": u.get("lifetime_premium", False),
                "account_status": u.get("account_status", "active"),
                "flag_count": u.get("flag_count", 0),
                "created_at": created_at
            })
        
        return {
            "users": formatted,
            "total": total_users,
            "limit": limit,
            "skip": skip
        }
    except Exception as e:
        print(f"[Admin Panel] Error fetching users: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")

@router.post("/admin/user/{user_id}/promote-admin")
async def promote_to_admin(user_id: str, token: Optional[str] = None):
    """Promote a user to admin status"""
    
    admin = await get_user_from_token(token)
    if not admin or not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Only top-level admins can promote others
    admin_level = admin.get("admin_level", 0)
    if isinstance(admin_level, str):
        admin_level = 10 if admin_level in ["full", "top", "owner"] else 0
    if admin_level < 10:
        raise HTTPException(status_code=403, detail="Only top-level admins can promote users")
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="User is already an admin")
    
    # Promote user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "is_admin": True,
                "admin_level": 5,  # Standard admin level
                "admin_promoted_by": str(admin["_id"]),
                "admin_promoted_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "success": True,
        "message": f"User {user.get('email')} has been promoted to admin"
    }

@router.post("/admin/user/{user_id}/demote-admin")
async def demote_from_admin(user_id: str, token: Optional[str] = None):
    """Remove admin status from a user"""
    
    admin = await get_user_from_token(token)
    if not admin or not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Only top-level admins can demote others
    admin_level = admin.get("admin_level", 0)
    if isinstance(admin_level, str):
        admin_level = 10 if admin_level in ["full", "top", "owner"] else 0
    if admin_level < 10:
        raise HTTPException(status_code=403, detail="Only top-level admins can demote admins")
    
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow demoting top-level admins or self
    if str(user["_id"]) == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    
    user_admin_level = user.get("admin_level", 0)
    if isinstance(user_admin_level, str):
        user_admin_level = 10 if user_admin_level in ["full", "top", "owner"] else 0
    if user_admin_level >= 10:
        raise HTTPException(status_code=400, detail="Cannot demote top-level admins")
    
    # Demote user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "is_admin": False,
                "admin_level": 0
            },
            "$unset": {
                "admin_promoted_by": "",
                "admin_promoted_at": ""
            }
        }
    )
    
    return {
        "success": True,
        "message": f"User {user.get('email')} has been demoted from admin"
    }

