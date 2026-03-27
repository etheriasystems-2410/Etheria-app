# Binaural Meditation Audio Setup Guide

## Overview
The binaural meditation feature provides brainwave entrainment through binaural beats - audio frequencies that synchronize brain activity to specific states (sleep, meditation, focus, etc.).

## Current Implementation

### Backend API Endpoints
1. **GET /api/meditation/binaural/frequencies** - Returns available frequency programs
2. **GET /api/meditation/binaural/audio/{frequency_id}** - Returns audio file information
3. **POST /api/meditation/session/save** - Saves completed meditation sessions
4. **GET /api/meditation/sessions** - Retrieves meditation history

### Frontend Components
- **useAudioPlayer** hook - Custom React hook for audio playback using expo-av
- **audioGenerator.ts** - Utility for binaural beat parameters
- **Enhanced binaural.tsx** - Full meditation session UI with:
  - 5 frequency programs (Delta, Theta, Alpha, Beta, Gamma)
  - Session timer and progress tracking
  - Visual waveform display
  - Session saving to database

### Available Frequencies

1. **Delta (0.5-4 Hz)** - Deep sleep, healing, pain relief
2. **Theta (4-8 Hz)** - Deep meditation, creativity, intuition
3. **Alpha (8-13 Hz)** - Relaxation, stress reduction
4. **Beta (13-30 Hz)** - Focus, concentration, alertness
5. **Gamma (30-100 Hz)** - Peak focus, cognitive enhancement

## Production Audio Integration

### Option 1: Use Pre-Recorded Binaural Beat Files
**Recommended for production**

1. **Purchase or Generate Audio Files:**
   - Buy from: iAwake Technologies, Brain.fm, Ennora Binaural Beats
   - Or generate using: Audacity, Gnaural, SBaGen
   - Format: MP3 or AAC, 30-60 minutes each
   - Stereo required (different frequency per channel)

2. **Host Audio Files:**
   ```
   /app/backend/audio/
   ├── delta-binaural.mp3
   ├── theta-binaural.mp3
   ├── alpha-binaural.mp3
   ├── beta-binaural.mp3
   └── gamma-binaural.mp3
   ```

3. **Update Backend to Serve Files:**
   ```python
   from fastapi.responses import FileResponse
   
   @api_router.get("/meditation/binaural/stream/{frequency_id}")
   async def stream_binaural_audio(frequency_id: str):
       audio_path = f"/app/backend/audio/{frequency_id}-binaural.mp3"
       return FileResponse(audio_path, media_type="audio/mpeg")
   ```

4. **Update Frontend to Load Audio:**
   ```typescript
   const audioUrl = `${BACKEND_URL}/api/meditation/binaural/stream/${frequencyId}`;
   await audioPlayer.loadAudio(audioUrl);
   await audioPlayer.play();
   ```

### Option 2: Use External Audio Service
Services like Brain.fm or Focus@Will provide API access:

```typescript
const response = await fetch('https://api.brain.fm/audio', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: JSON.stringify({ type: 'focus', duration: 30 })
});
const { audioUrl } = await response.json();
await audioPlayer.loadAudio(audioUrl);
```

### Option 3: Generate Binaural Beats in Real-Time
Using Web Audio API (browser only):

```typescript
const audioContext = new AudioContext();
const leftOscillator = audioContext.createOscillator();
const rightOscillator = audioContext.createOscillator();

leftOscillator.frequency.value = 200; // Base frequency
rightOscillator.frequency.value = 206; // Base + beat (6 Hz theta)

// Connect to left and right channels
const merger = audioContext.createChannelMerger(2);
leftOscillator.connect(merger, 0, 0);
rightOscillator.connect(merger, 0, 1);
merger.connect(audioContext.destination);

leftOscillator.start();
rightOscillator.start();
```

## Current Placeholder Behavior

The app currently:
- Loads frequency programs from backend API ✅
- Displays program information and benefits ✅
- Tracks session duration ✅
- Saves sessions to database ✅
- Shows visual feedback (waveforms, pulsing orb) ✅
- **Does NOT play actual audio** ⚠️

The `useAudioPlayer` hook is ready but needs actual audio URLs to function.

## Adding Actual Audio - Quick Start

1. **Add audio files to backend:**
   ```bash
   mkdir -p /app/backend/audio
   # Copy your binaural beat MP3 files here
   ```

2. **Update server.py** to serve files:
   ```python
   from fastapi.responses import StreamingResponse
   import os
   
   @api_router.get("/meditation/binaural/stream/{frequency_id}")
   async def stream_audio(frequency_id: str):
       file_path = f"/app/backend/audio/{frequency_id}-binaural.mp3"
       if not os.path.exists(file_path):
           raise HTTPException(404, "Audio file not found")
       
       def file_iterator():
           with open(file_path, 'rb') as f:
               yield from f
       
       return StreamingResponse(
           file_iterator(),
           media_type="audio/mpeg",
           headers={"Accept-Ranges": "bytes"}
       )
   ```

3. **Update binaural.tsx** to use real audio:
   ```typescript
   const startSession = async () => {
     const audioUrl = `${BACKEND_URL}/api/meditation/binaural/stream/${selectedProgram.id}`;
     await audioPlayer.loadAudio(audioUrl);
     await audioPlayer.play();
     setSessionStartTime(Date.now());
   };
   ```

## Testing Audio Playback

Test the audio player with a sample file:
```bash
curl -o /app/backend/audio/test.mp3 https://www.soundhealing.com/samples/432hz.mp3
```

Then update the code to load this test file.

## Recommended Audio Specifications

- **Format:** MP3 (320 kbps) or AAC
- **Duration:** 30-60 minutes (loopable)
- **Sample Rate:** 44.1 kHz
- **Channels:** Stereo (critical for binaural effect)
- **Volume:** Normalized to -3dB to prevent clipping
- **Fade:** 2-second fade in/out for smooth experience

## Free Binaural Beat Resources

1. **MyNoise.net** - Free binaural beat generator
2. **YouTube Audio Library** - Some free binaural tracks
3. **FreeBinauralBeats.com** - Download free tracks
4. **Gnaural** - Open-source binaural beat generator

## Future Enhancements

- [ ] Offline audio caching
- [ ] Background playback during app minimization
- [ ] Volume control slider
- [ ] Mix ambient sounds with binaural beats
- [ ] Guided meditation voice overlay
- [ ] Session playlists and routines
- [ ] Sleep timer with gradual volume fade
- [ ] Haptic feedback sync with beats
- [ ] Apple Watch integration for heart rate monitoring

## Important Notes

⚠️ **Headphones Required:** Binaural beats only work with stereo headphones (left/right separation)

⚠️ **Not for Everyone:** People with epilepsy, seizure disorders, or heart conditions should consult a doctor before using binaural beats

⚠️ **No Medical Claims:** This is a meditation tool, not medical treatment

## File Structure

```
/app/
├── frontend/
│   ├── hooks/
│   │   └── useAudioPlayer.ts       # Audio playback hook
│   ├── utils/
│   │   └── audioGenerator.ts       # Frequency parameters
│   └── app/
│       └── meditation/
│           └── binaural.tsx        # Main binaural UI
└── backend/
    ├── server.py                   # API endpoints
    └── audio/                      # Audio files (add this)
        ├── delta-binaural.mp3
        ├── theta-binaural.mp3
        ├── alpha-binaural.mp3
        ├── beta-binaural.mp3
        └── gamma-binaural.mp3
```
