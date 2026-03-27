# Authentication Implementation Guide

## Backend Auth Endpoints (Add to server.py)

Add these models and endpoints after the zodiac endpoints:

```python
# Auth Models
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: str

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_session_token() -> str:
    return f"session_{uuid.uuid4().hex}"

def create_jwt_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    # Check session_token from cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user_doc

# Auth Endpoints
@api_router.post("/auth/signup")
async def signup(request: SignupRequest):
    # Check if user exists
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request.password)
    
    user_doc = {
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "password_hash": password_hash,
        "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = create_session_token()
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Return user and set cookie
    response = JSONResponse(content={
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "picture": None
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/",
        samesite="lax"
    )
    
    return response

@api_router.post("/auth/login")
async def login(request: LoginRequest):
    # Find user
    user_doc = await db.users.find_one({"email": request.email})
    
    if not user_doc or not verify_password(request.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create session
    session_token = create_session_token()
    session_doc = {
        "session_token": session_token,
        "user_id": user_doc["user_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Return user and set cookie
    response = JSONResponse(content={
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "picture": user_doc.get("picture")
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
        path="/",
        samesite="lax"
    )
    
    return response

@api_router.post("/auth/google-callback")
async def google_auth_callback(session_id: str):
    """Exchange Emergent OAuth session_id for user data"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                EMERGENT_AUTH_SESSION_ENDPOINT,
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session ID")
            
            data = response.json()
            
            # Check if user exists, create if not
            user_doc = await db.users.find_one({"email": data["email"]})
            
            if not user_doc:
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                user_doc = {
                    "user_id": user_id,
                    "email": data["email"],
                    "name": data["name"],
                    "picture": data.get("picture"),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user_doc)
            else:
                # Update name and picture if changed
                await db.users.update_one(
                    {"user_id": user_doc["user_id"]},
                    {"$set": {
                        "name": data["name"],
                        "picture": data.get("picture")
                    }}
                )
            
            # Create session using token from Emergent
            session_token = data["session_token"]
            session_doc = {
                "session_token": session_token,
                "user_id": user_doc["user_id"],
                "expires_at": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.user_sessions.insert_one(session_doc)
            
            # Return user and set cookie
            response_obj = JSONResponse(content={
                "user_id": user_doc["user_id"],
                "email": user_doc["email"],
                "name": user_doc["name"],
                "picture": user_doc.get("picture")
            })
            
            response_obj.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60,
                path="/",
                samesite="lax"
            )
            
            return response_obj
            
    except Exception as e:
        logging.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response = JSONResponse(content={"success": True})
    response.delete_cookie("session_token", path="/")
    return response
```

## Frontend - Add to package.json dependencies

```bash
cd /app/frontend && yarn add @react-navigation/native-stack
```

## Frontend Auth Screens

Create these files in `/app/frontend/app/auth/`:

1. `login.tsx` - Login screen with email/password + Google button
2. `signup.tsx` - Signup screen
3. `callback.tsx` - OAuth callback handler

## Update _layout.tsx

Wrap app with auth provider and protected routes.

## Test Credentials

Email: test@example.com
Password: Test123!
