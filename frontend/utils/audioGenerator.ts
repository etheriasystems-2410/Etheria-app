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
export const getBinauralAudioUrl = (frequencyId: string): string | null => {
  // These are placeholder URLs - in production, you would:
  // 1. Use pre-recorded binaural beat audio files
  // 2. Use a binaural beat generation API
  // 3. Generate them using Web Audio API (browser only)
  
  const audioMap: { [key: string]: string } = {
    delta: 'https://example.com/audio/delta-binaural.mp3',
    theta: 'https://example.com/audio/theta-binaural.mp3',
    alpha: 'https://example.com/audio/alpha-binaural.mp3',
    beta: 'https://example.com/audio/beta-binaural.mp3',
    gamma: 'https://example.com/audio/gamma-binaural.mp3',
  };

  return audioMap[frequencyId] || null;
};

/**
 * Get ambient sound URL
 */
export const getAmbientSoundUrl = (soundId: string): string | null => {
  // Placeholder URLs for ambient sounds
  // In production, use actual audio files hosted on your server or CDN
  const soundMap: { [key: string]: string } = {
    ocean: 'https://example.com/audio/ocean-waves.mp3',
    rain: 'https://example.com/audio/rainfall.mp3',
    forest: 'https://example.com/audio/forest-sounds.mp3',
    'singing-bowl': 'https://example.com/audio/singing-bowl.mp3',
    silence: null as any,
  };

  return soundMap[soundId] || null;
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
