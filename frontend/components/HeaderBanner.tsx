import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useFonts, Cinzel_700Bold, Cinzel_400Regular } from '@expo-google-fonts/cinzel';

const HEADER_BANNER_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/oz3admmj_47815.jpg';

interface HeaderBannerProps {
  title?: string;
  height?: number;
}

export default function HeaderBanner({ title = 'Etheria', height = 120 }: HeaderBannerProps) {
  const [fontsLoaded] = useFonts({
    Cinzel_700Bold,
    Cinzel_400Regular,
  });

  return (
    <View style={[styles.headerBanner, { height }]}>
      <Image
        source={{ uri: HEADER_BANNER_IMAGE }}
        style={styles.headerBannerImage}
        contentFit="cover"
      />
      <View style={styles.headerBannerOverlay}>
        {fontsLoaded ? (
          <Text style={styles.headerBannerTitle}>{title}</Text>
        ) : (
          <Text style={styles.headerBannerTitleFallback}>{title}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBanner: {
    width: '100%',
    position: 'relative',
  },
  headerBannerImage: {
    width: '100%',
    height: '100%',
  },
  headerBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 0, 20, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBannerTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 28,
    color: '#fff',
    letterSpacing: 6,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(159, 122, 234, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  headerBannerTitleFallback: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 6,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(159, 122, 234, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
