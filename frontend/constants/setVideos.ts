/**
 * Set videos — one fixed video per meditation type and per reprogramming
 * session, chosen as a mix of Pexels and Pixabay (see credits below).
 *
 * These are the pinned defaults. For reprogramming, the set video WINS over
 * the dynamic Pexels theme fetch in ReprogrammingVisuals: the detail screen
 * passes the set video as `videoUri`, and the fetch only runs when no set
 * video is given (unknown session id) — it is a fallback, never an override.
 *
 * Video files live in frontend/assets/set-videos/. They were downloaded
 * from the free Pexels/Pixabay pages listed below (no sponsored iStock
 * content) and re-encoded to max 720p (1280x720 landscape, 720x1280 for
 * the vertical timed clip) with audio stripped, since they play muted as
 * backgrounds. Originals are not bundled.
 *
 * Creator names below are exactly as listed on the source pages.
 * "Video: <creator> via Pexels/Pixabay" credit lines are rendered from
 * this mapping on the video screens.
 */

export interface SetVideo {
  /** Bundled local video asset (require result). */
  video: number;
  source: 'Pexels' | 'Pixabay';
  sourceUrl: string;
  creator: string;
  credit: string;
}

function entry(
  video: number,
  source: 'Pexels' | 'Pixabay',
  sourceUrl: string,
  creator: string,
): SetVideo {
  return { video, source, sourceUrl, creator, credit: `Video: ${creator} via ${source}` };
}

export const MEDITATION_SET_VIDEOS: Record<string, SetVideo> = {
  chakra: entry(
    require('../assets/set-videos/meditation-chakra.mp4'),
    'Pexels',
    'https://www.pexels.com/video/dynamic-abstract-orange-rotating-light-animation-36727577/',
    'Colin Jones',
  ),
  binaural: entry(
    require('../assets/set-videos/meditation-binaural.mp4'),
    'Pexels',
    'https://www.pexels.com/video/slow-motion-wave-18680290/',
    'Eclipse Chasers',
  ),
  aiGuided: entry(
    require('../assets/set-videos/meditation-ai-guided.mp4'),
    'Pexels',
    'https://www.pexels.com/video/silhouette-of-a-woman-meditating-on-a-rock-by-the-sea-10638262/',
    'Kostas Exarhos',
  ),
  timed: entry(
    require('../assets/set-videos/meditation-timed.mp4'),
    'Pexels',
    'https://www.pexels.com/video/the-sun-is-shining-through-the-trees-in-the-grass-27100098/',
    'Kuba Kaczorowski',
  ),
  astral: entry(
    require('../assets/set-videos/meditation-astral.mp4'),
    'Pixabay',
    'https://pixabay.com/videos/yogi-cosmic-earth-moon-galaxy-42373/',
    'ChristianBodhi',
  ),
};

export const REPROGRAMMING_SET_VIDEOS: Record<string, SetVideo> = {
  'deep-sleep': entry(
    require('../assets/set-videos/reprogramming-deep-sleep.mp4'),
    'Pexels',
    'https://www.pexels.com/video/serene-moonlit-ocean-waves-at-night-39293076/',
    'N. Kumar',
  ),
  confidence: entry(
    require('../assets/set-videos/reprogramming-confidence.mp4'),
    'Pixabay',
    'https://pixabay.com/videos/sunrise-birds-nature-clouds-35254/',
    'ZAIDoopro',
  ),
  'quit-smoking': entry(
    require('../assets/set-videos/reprogramming-quit-smoking.mp4'),
    'Pexels',
    'https://www.pexels.com/video/white-clouds-over-sky-11984945/',
    'Jeremy Müller',
  ),
  'weight-loss': entry(
    require('../assets/set-videos/reprogramming-weight-loss.mp4'),
    'Pexels',
    'https://www.pexels.com/video/flowing-water-in-the-forest-river-7067021/',
    'Victor Rogov',
  ),
  'release-anxiety': entry(
    require('../assets/set-videos/reprogramming-release-anxiety.mp4'),
    'Pexels',
    'https://www.pexels.com/video/clouds-over-sea-in-cold-weather-10934316/',
    'Ella Wei',
  ),
  abundance: entry(
    require('../assets/set-videos/reprogramming-abundance.mp4'),
    'Pixabay',
    'https://pixabay.com/videos/clouds-iridescence-phenomenon-168623/',
    'Gylfi',
  ),
  'self-love': entry(
    require('../assets/set-videos/reprogramming-self-love.mp4'),
    'Pexels',
    'https://www.pexels.com/video/cappadocia-drone-scene-27436406/',
    'Okan Demiray',
  ),
  focus: entry(
    require('../assets/set-videos/reprogramming-focus.mp4'),
    'Pexels',
    'https://www.pexels.com/video/hypnotic-rotating-optical-illusion-tunnel-35667586/',
    'Nicola Narracci',
  ),
  'release-fear': entry(
    require('../assets/set-videos/reprogramming-release-fear.mp4'),
    'Pexels',
    'https://www.pexels.com/video/a-yellow-spiral-with-lines-in-the-middle-28491478/',
    'Shubham Kumar',
  ),
  'manifest-love': entry(
    require('../assets/set-videos/reprogramming-manifest-love.mp4'),
    'Pexels',
    'https://www.pexels.com/video/stunning-cosmic-nebula-with-stars-in-deep-space-31084223/',
    'Adis Resic',
  ),
  'healing-body': entry(
    require('../assets/set-videos/reprogramming-healing-body.mp4'),
    'Pexels',
    'https://www.pexels.com/video/aerial-view-of-mountain-river-flowing-6569018/',
    'Khalid Khalitov',
  ),
  'release-past': entry(
    require('../assets/set-videos/reprogramming-release-past.mp4'),
    'Pexels',
    'https://www.pexels.com/video/close-up-shot-of-a-flower-4178357/',
    'Thanapat Samranrat',
  ),
};
