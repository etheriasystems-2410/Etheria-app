from routes.pexels_proxy import router as pexels_router
app.include_router(api_router)
app.include_router(pexels_router, prefix="/api")

# Import and register moderation routes (extracted from server.py)
from routes.moderation import router as moderation_router, set_db as set_moderation_db
set_moderation_db(db)
app.include_router(moderation_router)

# Import and register training routes (extracted from server.py - no DB deps)
from routes.training import router as training_router
app.include_router(training_router, prefix="/api")

# Import and register auth routes (extracted from server.py)
from routes.auth import router as auth_router, set_db as set_auth_db, set_config as set_auth_config
set_auth_db(db)
set_auth_config(JWT_EXPIRATION_DAYS=JWT_EXPIRATION_DAYS, EMERGENT_AUTH_SESSION_ENDPOINT=EMERGENT_AUTH_SESSION_ENDPOINT)
app.include_router(auth_router)

# Import and register journal routes (extracted from server.py)
from routes.journal import router as journal_router, set_db as set_journal_db
set_journal_db(db)
app.include_router(journal_router)

# Import and register DM (messages) routes
from routes.messages import router as messages_router, set_db as set_messages_db
set_messages_db(db)
app.include_router(messages_router)
