import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType, ViewStyle } from 'react-native';

interface BackgroundImageProps {
  source: ImageSourcePropType;
  opacity?: number;
  overlayColor?: string;
  children: React.ReactNode;
  style?: ViewStyle;
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
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Background Image Layer */}
      <Image
        source={source}
        style={[styles.backgroundImage, { opacity }]}
        resizeMode="cover"
      />
      {/* Overlay Layer */}
      <View style={[styles.overlay, { backgroundColor: overlayColor }]} />
      {/* Content Layer */}
      <View style={styles.content}>
        {children}
      </View>
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
});

export default BackgroundImage;
