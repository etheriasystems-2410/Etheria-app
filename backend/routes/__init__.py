"""
Route modules for Etheria backend
"""
from .training import router as training_router
from .oracle import router as oracle_router
from .journal import router as journal_router
from .auth import router as auth_router

__all__ = [
    'training_router',
    'oracle_router',
    'journal_router',
    'auth_router',
]
