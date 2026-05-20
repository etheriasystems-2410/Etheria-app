/**
 * SplashVideo - Plays an intro video over the app immediately after the native
 * splash hides. Once the video finishes (or hits a max duration) it fades out
 * and reveals the app.
 *
 * The native (static image) splash from app.json (splash-frame.png — the first
 * frame of this same video) is shown during cold boot before React Native is
 * ready. This component bridges from that moment to the first app screen
 * seamlessly.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Animated, Easing, ActivityIndicator, Platform, Image } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// Local bundled video (watermark cropped, ~900 KB). Falls back to a static
// image if the video player fails to load.
const SPLASH_VIDEO = require('../assets/video/splash-video.mp4');
const SPLASH_FRAME = require('../assets/images/splash-frame.png');

const MAX_DURATION_MS = 5000; // video is 4s — give it 1s buffer
const FADE_OUT_MS = 500;

interface Props {
  onDone: () => void;
}

export const SplashVideo: React.FC<Props> = ({ onDone }) => {
  const opacity = useState(new Animated.Value(1))[0];
  const [hidden, setHidden] = useState(false);

  const player = useVideoPlayer(SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = true; // splash plays muted — respects silent mode and avoids surprises
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

  // Skip the video entirely on web — VideoView/MP4 autoplay is flaky there.
  // Show the static frame for a beat instead so web users still see the brand moment.
  useEffect(() => {
    if (Platform.OS === 'web') {
      const t = setTimeout(dismiss, 1200);
      return () => clearTimeout(t);
    }
  }, [dismiss]);

  if (Platform.OS === 'web') {
    return (
      <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity }]} pointerEvents="none">
        <Image source={SPLASH_FRAME} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, { opacity }]} pointerEvents="none">
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
