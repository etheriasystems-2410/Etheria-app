/**
 * SplashVideo - Plays an intro video over the app immediately after the native
 * splash hides. Once the video finishes (or hits a max duration) it fades out
 * and reveals the app.
 *
 * The native (static image) splash from app.json is still shown during cold
 * boot before React Native is ready. This component bridges from that moment
 * to the first app screen.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Animated, Easing, ActivityIndicator, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

const SPLASH_VIDEO_URL =
  'https://customer-assets.emergentagent.com/job_a75d84fa-0948-4f28-9189-c803d31a5037/artifacts/vq0efewy_storage_emulated_0_DCIM_Google_Photos_20260506_084935-VIDEO_GEN.mp4';

const MAX_DURATION_MS = 6000; // safety: never block app longer than 6s
const FADE_OUT_MS = 600;

interface Props {
  onDone: () => void;
}

export const SplashVideo: React.FC<Props> = ({ onDone }) => {
  const opacity = useState(new Animated.Value(1))[0];
  const [hidden, setHidden] = useState(false);

  const player = useVideoPlayer(SPLASH_VIDEO_URL, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  // Fade out + dismiss
  const dismiss = React.useCallback(() => {
    if (hidden) return;
    setHidden(true);
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      onDone();
    });
  }, [hidden, onDone, opacity]);

  // Listen for end of playback
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => dismiss());
    return () => {
      try { sub.remove(); } catch {}
    };
  }, [player, dismiss]);

  // Safety timer
  useEffect(() => {
    const t = setTimeout(dismiss, MAX_DURATION_MS);
    return () => clearTimeout(t);
  }, [dismiss]);

  // Skip the video entirely on web — VideoView/MP4 autoplay is flaky there
  useEffect(() => {
    if (Platform.OS === 'web') {
      const t = setTimeout(dismiss, 100);
      return () => clearTimeout(t);
    }
  }, [dismiss]);

  if (Platform.OS === 'web') return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity }]} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <ActivityIndicator
        size="small"
        color="rgba(255,255,255,0.4)"
        style={styles.spinner}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0014',
    zIndex: 999,
  },
  spinner: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
});

export default SplashVideo;
