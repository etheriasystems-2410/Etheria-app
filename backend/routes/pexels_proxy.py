from fastapi import APIRouter, HTTPException, Query
import os
import httpx
from typing import Optional
import time

router = APIRouter()

PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")  # MUST be set in backend env
_cache = {}
CACHE_TTL_SECONDS = 60 * 5  # 5 minutes


@router.get("/media/pexels")
async def pexels_search(query: str = Query("celestial galaxy stars nebula", min_length=1), prefer: Optional[str] = Query(None)):
    """
    Proxy to Pexels. Returns JSON: { type: 'video'|'image', url: 'https://...' }.
    prefer: optional hint: 'video' or 'photo'
    """
    if not PEXELS_API_KEY:
        raise HTTPException(status_code=500, detail="Pexels API key not configured on server")

    cache_key = f"pexels:{query}:{prefer or 'auto'}"
    cached = _cache.get(cache_key)
    now = time.time()
    if cached and (now - cached["ts"]) < CACHE_TTL_SECONDS:
        return cached["value"]

    headers = {"Authorization": PEXELS_API_KEY}
    async with httpx.AsyncClient(timeout=10.0) as client:
        # try video first if prefer == 'video' or auto
        try_video = prefer in (None, "video")
        try_image = prefer in (None, "photo")

        if try_video:
            try:
                v_resp = await client.get(f"https://api.pexels.com/videos/search?query={query}&per_page=3", headers=headers)
            except Exception:
                v_resp = None
            if v_resp and v_resp.status_code == 200:
                vjson = v_resp.json()
                if vjson.get("videos"):
                    # choose best HD or sd fallback
                    for vid in vjson["videos"]:
                        files = vid.get("video_files", [])
                        file = next((f for f in files if f.get("quality") == "hd"), None) or (files[0] if files else None)
                        if file and file.get("link"):
                            value = {"type": "video", "url": file["link"]}
                            _cache[cache_key] = {"ts": now, "value": value}
                            return value

        if try_image:
            try:
                p_resp = await client.get(f"https://api.pexels.com/v1/search?query={query}&per_page=3", headers=headers)
            except Exception:
                p_resp = None
            if p_resp and p_resp.status_code == 200:
                pjson = p_resp.json()
                photos = pjson.get("photos", [])
                if photos:
                    photo = photos[0]
                    src = photo.get("src", {})
                    url = src.get("large2x") or src.get("large") or src.get("original")
                    if url:
                        value = {"type": "image", "url": url}
                        _cache[cache_key] = {"ts": now, "value": value}
                        return value

    # fallback: no media found
    raise HTTPException(status_code=404, detail="No media found from Pexels for that query")
