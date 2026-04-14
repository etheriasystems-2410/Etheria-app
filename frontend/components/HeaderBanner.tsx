import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const HEADER_BANNER_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/oz3admmj_47815.jpg';

interface HeaderBannerProps {
  title?: string;
  height?: number;
}

export default function HeaderBanner({ title = 'Etheria', height = 120 }: HeaderBannerProps) {
  return (
    <View style={[styles.headerBanner, { height }]}>
      <Image
        source={{ uri: HEADER_BANNER_IMAGE }}
        style={styles.headerBannerImage}
        contentFit="cover"
      />
      <View style={styles.headerBannerOverlay}>
        <Text style={styles.headerBannerTitle}>{title}</Text>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
