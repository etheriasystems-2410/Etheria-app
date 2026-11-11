/**
 * Session-matched reprogramming music beds.
 *
 * AUDIT FINDING (2026-11-04): before this change there was NO per-session
 * music. The narration is ElevenLabs TTS per session script, and the music
 * bed was a RANDOM pick from 5 generic hypnotic/trance tracks
 * (backend/routes/reprogramming_audio.py, 110–138 BPM, no frequency, no
 * session match). This mapping replaces that random pick: each session now
 * gets its own bed, tuned to a frequency commonly cited for that session's
 * purpose, at its own BPM.
 *
 * The beds are synthesized in-app assets (frontend/assets/set-music/):
 * a drone/pad whose root is the session frequency, a subharmonic bass in
 * the same octave family, a strong kick on every beat, gentle offbeat
 * hats and a slow pluck arpeggio. Each file is one loop of 64 beats, and
 * the app loops it under the voice. The bed plays at the app's usual low
 * bed volume (~0.30 vs voice ~0.90), so the beat is present as an
 * undertone without masking the spoken guidance or the video.
 *
 * Frequency associations are the widely cited Solfeggio / angel-number
 * associations for these tunings. They are tuning labels, NOT medical
 * claims, and nothing here claims a health outcome.
 *
 * Light matching: the session BPM drives the ReprogrammingVisuals pulse
 * and the Light Therapy beat-sync pulse (via musicBpm), and the session
 * brainwave band selects the Light Therapy preset hue. In reprogramming
 * sessions the light pulse is capped at 2 Hz (see maxPulseHz in
 * LightTherapyController) so the light stays a gentle pulse — never the
 * harsh rapid strobing of the 20/40 Hz presets.
 */

export interface SessionMusic {
  /** Bundled local audio asset (require result). */
  asset: number;
  /** Tuning frequency of the bed, in Hz. */
  frequencyHz: number;
  /** Beat tempo of the bed, in BPM. */
  bpm: number;
  /** Commonly cited association for this tuning (not a medical claim). */
  association: string;
  /** Brainwave band used for the Light Therapy preset hue. */
  bandHz: number;
  bandName: 'delta' | 'theta' | 'alpha' | 'beta';
}

function track(
  asset: number,
  frequencyHz: number,
  bpm: number,
  association: string,
  bandHz: number,
  bandName: SessionMusic['bandName'],
): SessionMusic {
  return { asset, frequencyHz, bpm, association, bandHz, bandName };
}

export const SESSION_MUSIC: Record<string, SessionMusic> = {
  'deep-sleep': track(
    require('../assets/set-music/deep-sleep.mp3'),
    174, 60, 'grounding / deep rest', 2, 'delta',
  ),
  confidence: track(
    require('../assets/set-music/confidence.mp3'),
    285, 90, 'energy / empowerment', 10, 'alpha',
  ),
  'quit-smoking': track(
    require('../assets/set-music/quit-smoking.mp3'),
    417, 80, 'change / breaking patterns', 6, 'theta',
  ),
  'weight-loss': track(
    require('../assets/set-music/weight-loss.mp3'),
    528, 100, 'transformation', 6, 'theta',
  ),
  'release-anxiety': track(
    require('../assets/set-music/release-anxiety.mp3'),
    432, 70, 'calm / stress relief', 10, 'alpha',
  ),
  abundance: track(
    require('../assets/set-music/abundance.mp3'),
    888, 90, 'manifestation / abundance', 6, 'theta',
  ),
  'self-love': track(
    require('../assets/set-music/self-love.mp3'),
    639, 80, 'love / connection', 10, 'alpha',
  ),
  focus: track(
    require('../assets/set-music/focus.mp3'),
    741, 110, 'clarity / focus', 20, 'beta',
  ),
  'release-fear': track(
    require('../assets/set-music/release-fear.mp3'),
    396, 70, 'release fear / guilt', 6, 'theta',
  ),
  'manifest-love': track(
    require('../assets/set-music/manifest-love.mp3'),
    639, 90, 'love / manifestation', 6, 'theta',
  ),
  'healing-body': track(
    require('../assets/set-music/healing-body.mp3'),
    528, 80, 'healing / transformation', 6, 'theta',
  ),
  'release-past': track(
    require('../assets/set-music/release-past.mp3'),
    963, 70, 'letting go / release', 6, 'theta',
  ),
};
