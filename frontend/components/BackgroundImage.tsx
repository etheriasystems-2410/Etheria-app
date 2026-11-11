import React from 'react';
import { View, Image, StyleSheet, Text, ImageSourcePropType, ViewStyle } from 'react-native';
import SetVideoBackground from './SetVideoBackground';

interface BackgroundImageProps {
  source: ImageSourcePropType;
  opacity?: number;
  overlayColor?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /**
   * Optional bundled set video (require result). When given, the video
   * plays looping and muted ON TOP of the static image, under the overlay
   * — so on web (video skipped) or if the video fails to load, the static
   * image is still the background. This is how meditation set videos work.
   */
  videoSource?: number;
  /** Small creator credit line, e.g. "Video: Colin Jones via Pexels". */
  credit?: string;
}

/**
 * Cross-platform background image component that works reliably on both web and native.
 * Uses absolute-positioned Image + overlay instead of ImageBackground with imageStyle
 * which doesn't work properly on Expo Web.
 */
export const BackgroundImage: React.FC<BackgroundImageProps> = ({
  source,
  opacity = 0.25,
  overlayColor = 'rgba(15, 3, 33, 0.75)',
  children,
  style,
  videoSource,
  credit,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Background Image Layer (also the fallback under the video) */}
      <Image
        source={source}
        style={[styles.backgroundImage, { opacity }]}
        resizeMode="cover"
      />
      {/* Set Video Layer (native only; skipped on web) */}
      {videoSource ? <SetVideoBackground video={videoSource} opacity={0.55} /> : null}
      {/* Overlay Layer */}
      <View style={[styles.overlay, { backgroundColor: overlayColor }]} />
      {/* Content Layer */}
      <View style={styles.content}>
        {children}
      </View>
      {/* Creator credit for the set video */}
      {credit ? (
        <Text style={styles.credit} pointerEvents="none">
          {credit}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0f0321',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  credit: {
    position: 'absolute',
    bottom: 6,
    right: 10,
    zIndex: 2,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
});

export default BackgroundImage;
