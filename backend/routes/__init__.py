"""
Route modules for Etheria backend
"""
from .training import router as training_router
from .oracle import router as oracle_router
from .journal import router as journal_router
from .auth import router as auth_router
from .spirit_guides import router as spirit_guides_router
from .dreams import router as dreams_router, zodiac_router
from .subscription import router as subscription_router, webhook_router, user_router

__all__ = [
    'training_router',
    'oracle_router',
    'journal_router',
    'auth_router',
    'spirit_guides_router',
    'dreams_router',
    'zodiac_router',
    'subscription_router',
    'webhook_router',
    'user_router',
]
