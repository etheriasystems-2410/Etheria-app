/**
 * SplashVideo — Plays the intro video over a black background immediately
 * after the native splash hides. Once the video finishes (or hits a max
 * duration) it fades out and reveals the app.
 *
 * Flow: native splash (solid black) → this component (black bg → video) → app.
 * No intermediate static logo image — straight from black into motion.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Animated, Easing, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

const SPLASH_VIDEO = require('../assets/video/splash-video.mp4');

const MAX_DURATION_MS = 9000;     // safety: never block app longer than this
const HOLD_AFTER_END_MS = 2500;   // hold final frame for a beat after end
const FADE_OUT_MS = 700;
// On web autoplay of MP4 can be flaky/blocked → fall back to a longer black
// hold so users still get the brand pause without a broken-video gap.
const WEB_BLACK_HOLD_MS = 2200;

interface Props {
  onDone: () => void;
}

export const SplashVideo: React.FC<Props> = ({ onDone }) => {
  const opacity = useState(new Animated.Value(1))[0];
  const [hidden, setHidden] = useState(false);

  const player = useVideoPlayer(SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = true; // splash plays muted — respects silent mode
    p.play();
  });

  const dismiss = React.useCallback(() => {
    if (hidden) return;
    setHidden(true);
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDone());
  }, [hidden, onDone, opacity]);

  // End of playback → hold a beat → fade out
  useEffect(() => {
    if (Platform.OS === 'web') return; // web uses a fixed timer instead
    const sub = player.addListener('playToEnd', () => {
      setTimeout(dismiss, HOLD_AFTER_END_MS);
    });
    return () => {
      try { sub.remove(); } catch {}
    };
  }, [player, dismiss]);

  // Safety / web timers
  useEffect(() => {
    const delay = Platform.OS === 'web' ? WEB_BLACK_HOLD_MS : MAX_DURATION_MS;
    const t = setTimeout(dismiss, delay);
    return () => clearTimeout(t);
  }, [dismiss]);

  // Web: just show the black background — most browsers gate MP4 autoplay
  // even when muted unless the user has interacted, so a guaranteed-black
  // hold is more reliable than a half-broken video.
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.container, { opacity }]}
        pointerEvents="none"
      />
    );
  }

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
