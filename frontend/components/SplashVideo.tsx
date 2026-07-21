/**
 * SplashVideo — Plays the intro video over a black background immediately
 * after the native splash hides. Once the video finishes (or hits a max
 * duration) it fades out and reveals the app.
 *
 * Flow: native splash (solid black) → this component (black bg → video) → app.
 * No intermediate static logo image — straight from black into motion.
 *
 * Defensive: if `expo-video` is missing (e.g. bad native build) or the video
 * file cannot be loaded, we still hold a black background for a moment then
 * dismiss so the app boots. The splash MUST never be able to hard-crash the app.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Animated, Easing, Platform } from 'react-native';

const SPLASH_VIDEO = require('../assets/video/splash-video.mp4');

const MAX_DURATION_MS = 9000;     // safety: never block app longer than this
const HOLD_AFTER_END_MS = 2500;   // hold final frame for a beat after end
const FADE_OUT_MS = 700;
// On web autoplay of MP4 can be flaky/blocked → fall back to a longer black
// hold so users still get the brand pause without a broken-video gap.
const WEB_BLACK_HOLD_MS = 2200;
// Native fallback if expo-video is missing / crashes
const NATIVE_FALLBACK_HOLD_MS = 1600;

// Lazily require expo-video so a missing native module never crashes the
// module load itself — the caller code below handles the missing case.
let expoVideo: {
  useVideoPlayer?: any;
  VideoView?: any;
} = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  expoVideo = require('expo-video');
} catch (e) {
  console.warn('[Splash] expo-video not available, falling back to black hold:', e);
}

interface Props {
  onDone: () => void;
}

export const SplashVideo: React.FC<Props> = ({ onDone }) => {
  const opacity = useState(new Animated.Value(1))[0];
  const [hidden, setHidden] = useState(false);
  const videoAvailable = !!(expoVideo.useVideoPlayer && expoVideo.VideoView);

  // Hook must be called unconditionally — but we swallow any error inside so a
  // codec / native-module failure doesn't hard-crash the app.
  let player: any = null;
  try {
    if (videoAvailable && Platform.OS !== 'web') {
      player = expoVideo.useVideoPlayer(SPLASH_VIDEO, (p: any) => {
        p.loop = false;
        // Audio ON — the splash video has an audio track the user wants to hear.
        // If the device is in silent mode iOS will respect that automatically.
        p.muted = false;
        try {
          p.volume = 1.0;
        } catch {
          /* older API */
        }
        try {
          p.play();
        } catch (e) {
          console.warn('[Splash] player.play() failed:', e);
        }
      });
    }
  } catch (e) {
    console.warn('[Splash] useVideoPlayer threw:', e);
  }

  const dismiss = React.useCallback(() => {
    if (hidden) return;
    setHidden(true);
    // Fade audio volume in parallel with opacity so the transition feels
    // like a single unified exit rather than a hard cut.
    if (player) {
      try {
        const startVol = typeof player.volume === 'number' ? player.volume : 1;
        const steps = 12;
        const stepMs = FADE_OUT_MS / steps;
        for (let i = 1; i <= steps; i += 1) {
          setTimeout(() => {
            try {
              player.volume = Math.max(0, startVol * (1 - i / steps));
            } catch {
              /* ignore */
            }
            if (i === steps) {
              try {
                player.muted = true;
                player.pause?.();
              } catch {
                /* ignore */
              }
            }
          }, stepMs * i);
        }
      } catch (e) {
        console.warn('[Splash] audio fade failed:', e);
      }
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDone());
  }, [hidden, onDone, opacity, player]);

  // End of playback → hold a beat → fade out
  useEffect(() => {
    if (Platform.OS === 'web' || !player) return;
    let sub: any;
    try {
      sub = player.addListener('playToEnd', () => {
        setTimeout(dismiss, HOLD_AFTER_END_MS);
      });
    } catch (e) {
      console.warn('[Splash] addListener failed:', e);
    }
    return () => {
      try {
        sub?.remove?.();
      } catch {
        /* noop */
      }
    };
  }, [player, dismiss]);

  // Safety / web timers
  useEffect(() => {
    let delay = MAX_DURATION_MS;
    if (Platform.OS === 'web') delay = WEB_BLACK_HOLD_MS;
    else if (!player) delay = NATIVE_FALLBACK_HOLD_MS;
    const t = setTimeout(dismiss, delay);
    return () => clearTimeout(t);
  }, [dismiss, player]);

  // Web or missing native module: just show the black background.
  if (Platform.OS === 'web' || !player) {
    return (
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.container, { opacity }]}
        pointerEvents="none"
      />
    );
  }

  const { VideoView } = expoVideo;
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, { opacity }]}
      pointerEvents="none"
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    zIndex: 9999,
  },
});

export default SplashVideo;
