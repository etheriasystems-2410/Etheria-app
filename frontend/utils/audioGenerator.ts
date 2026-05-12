/**
 * Binaural Beat Audio Generator Utility
 * Generates audio URLs for different brainwave frequencies
 */

export interface BinauralFrequency {
  id: string;
  name: string;
  baseFrequency: number;
  beatFrequency: number;
  description: string;
}

export const BINAURAL_FREQUENCIES: BinauralFrequency[] = [
  {
    id: 'delta',
    name: 'Delta (Deep Sleep)',
    baseFrequency: 200,
    beatFrequency: 2,
    description: '0.5-4 Hz - Deep sleep, healing, pain relief',
  },
  {
    id: 'theta',
    name: 'Theta (Meditation)',
    baseFrequency: 200,
    beatFrequency: 6,
    description: '4-8 Hz - Deep meditation, creativity, intuition',
  },
  {
    id: 'alpha',
    name: 'Alpha (Relaxation)',
    baseFrequency: 200,
    beatFrequency: 10,
    description: '8-13 Hz - Relaxation, stress reduction, light meditation',
  },
  {
    id: 'beta',
    name: 'Beta (Focus)',
    baseFrequency: 200,
    beatFrequency: 20,
    description: '13-30 Hz - Focus, concentration, alertness',
  },
  {
    id: 'gamma',
    name: 'Gamma (Peak Performance)',
    baseFrequency: 200,
    beatFrequency: 40,
    description: '30-100 Hz - Peak focus, cognitive enhancement',
  },
];

/**
 * Generate binaural beat audio using Web Audio API or external service
 * For production, you would use pre-recorded binaural beat files
 * or integrate with a binaural beat generation service
 */
export const getBinauralAudioUrl = (_frequencyId: string): string | null => {
  // Placeholder integration point. Real audio files are not bundled with the
  // app yet — returning null so callers fall back to their silent/visual mode.
  // To enable real binaural beats, host audio files on a CDN and either:
  //   1) Hardcode URLs here, or
  //   2) Read from an env var, or
  //   3) Fetch via a backend endpoint
  return null;
};

/**
 * Get ambient sound URL
 */
export const getAmbientSoundUrl = (_soundId: string): string | null => {
  // Placeholder integration point — see getBinauralAudioUrl above.
  return null;
};

/**
 * Generate binaural beat parameters for audio synthesis
 */
export const getBinauralParams = (frequencyId: string) => {
  const frequency = BINAURAL_FREQUENCIES.find((f) => f.id === frequencyId);
  if (!frequency) return null;

  return {
    leftEar: frequency.baseFrequency,
    rightEar: frequency.baseFrequency + frequency.beatFrequency,
    beatFrequency: frequency.beatFrequency,
    name: frequency.name,
  };
};
