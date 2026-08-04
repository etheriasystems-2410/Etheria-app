"""
Pexels theme-video service.

Powers the Reprogramming visual layer: for a given `theme` (confidence,
sleep, love, ...) this endpoint queries the Pexels video API for a
curated selection of royalty-free calming loops, caches the result, and
returns one at random on every call so users see varied backdrops.

Attribution note
----------------
Pexels' license permits free use with attribution encouraged. The
returned payload includes the photographer + link so the frontend can
optionally render a "Video by X on Pexels" credit.
"""
from __future__ import annotations

import logging
import os
import random
import time
from typing import Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reprogramming", tags=["reprogramming-visuals"])

PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search"


# Theme → curated search terms. Each theme picks ONE at random per fetch.
THEME_QUERIES: Dict[str, List[str]] = {
    "confidence": [
        "golden sunrise",
        "sun rays forest",
        "mountain summit sunrise",
        "aerial golden sunset",
    ],
    "sleep": [
        "night sky stars",
        "milky way slow",
        "dark forest moonlight",
        "aurora borealis slow",
    ],
    "anxiety": [
        "gentle waves calm ocean",
        "slow clouds sky",
        "peaceful lake reflection",
        "misty morning forest",
    ],
    "abundance": [
        "sunlit forest",
        "gold particles light",
        "field of flowers wind",
        "cascade waterfall slow",
    ],
    "love": [
        "pink flowers slow motion",
        "sunset heart clouds",
        "rose petals falling",
        "warm bokeh lights",
    ],
    "focus": [
        "flowing water minimalist",
        "geometric lights",
        "slow zen sand",
        "candle flame steady",
    ],
    "health": [
        "green forest sun",
        "mountain river flowing",
        "sunrise nature",
        "leaf droplet macro",
    ],
    "default": [
        "cosmic nebula",
        "aurora sky",
        "purple particles",
        "night sky galaxy",
    ],
}


# ── In-memory cache — { (theme, query) -> (fetched_at, [videos]) } ────
_CACHE: Dict[Tuple[str, str], Tuple[float, List[Dict]]] = {}
_CACHE_TTL_SEC = 12 * 60 * 60  # 12 hours


def _pick_file_url(files: List[Dict]) -> Optional[str]:
    """Prefer HD-but-not-huge MP4 files (≤ 1280 wide) so we don't blow the
    user's data plan mid-meditation."""
    if not files:
        return None
    candidates = [
        f for f in files
        if f.get("file_type") == "video/mp4"
        and (f.get("width") or 0) <= 1280
        and (f.get("height") or 0) <= 1280
    ]
    if not candidates:
        candidates = [f for f in files if f.get("file_type") == "video/mp4"]
    if not candidates:
        return None
    # Pick the largest under-cap so quality is decent.
    candidates.sort(key=lambda f: (f.get("width") or 0) * (f.get("height") or 0), reverse=True)
    return candidates[0].get("link")


async def _fetch_pexels_videos(query: str) -> List[Dict]:
    """Call Pexels API and normalise the result to the fields we need."""
    if not PEXELS_API_KEY:
        raise HTTPException(status_code=500, detail="PEXELS_API_KEY not configured")

    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(
            PEXELS_SEARCH_URL,
            headers={"Authorization": PEXELS_API_KEY},
            params={
                "query": query,
                "per_page": 15,
                "orientation": "portrait",
                "size": "medium",
            },
        )
        if r.status_code != 200:
            logger.warning(
                "Pexels API returned %s for query %r: %s",
                r.status_code, query, r.text[:200],
            )
            return []
        data = r.json() or {}

    results = []
    for v in data.get("videos", []):
        url = _pick_file_url(v.get("video_files") or [])
        if not url:
            continue
        results.append({
            "video_id": v.get("id"),
            "video_url": url,
            "duration": v.get("duration"),
            "width": v.get("width"),
            "height": v.get("height"),
            "photographer": (v.get("user") or {}).get("name"),
            "photographer_url": (v.get("user") or {}).get("url"),
            "pexels_url": v.get("url"),
        })
    return results


@router.get("/theme-video/{theme}")
async def get_theme_video(theme: str) -> Dict:
    """Return one random themed video for the Reprogramming visual layer.

    Response shape:
    ```
    {
        "theme": "confidence",
        "query": "golden sunrise",
        "video_url": "https://.../video.mp4",
        "photographer": "Jane Doe",
        "pexels_url": "https://www.pexels.com/video/...",
        "attribution": "Video by Jane Doe on Pexels"
    }
    ```
    """
    theme = (theme or "").strip().lower()
    if theme not in THEME_QUERIES:
        theme = "default"

    query = random.choice(THEME_QUERIES[theme])
    key = (theme, query)
    now = time.time()

    cached = _CACHE.get(key)
    if cached and now - cached[0] < _CACHE_TTL_SEC:
        pool = cached[1]
    else:
        try:
            pool = await _fetch_pexels_videos(query)
            _CACHE[key] = (now, pool)
        except HTTPException:
            raise
        except Exception as e:  # pragma: no cover
            logger.exception("Pexels fetch failed: %s", e)
            pool = []

    if not pool:
        return {
            "theme": theme,
            "query": query,
            "video_url": None,
            "attribution": None,
        }

    pick = random.choice(pool)
    photog = pick.get("photographer") or "Pexels"
    return {
        "theme": theme,
        "query": query,
        "video_url": pick["video_url"],
        "video_id": pick.get("video_id"),
        "duration": pick.get("duration"),
        "photographer": photog,
        "photographer_url": pick.get("photographer_url"),
        "pexels_url": pick.get("pexels_url"),
        "attribution": f"Video by {photog} on Pexels",
    }
