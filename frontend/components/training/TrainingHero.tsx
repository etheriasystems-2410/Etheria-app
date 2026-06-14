/**
 * Training hero banner — full-width image with mystical title overlay.
 * Extracted from `app/training.tsx`.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  title: string;
  subtitle: string;
}

export default function TrainingHero({ title, subtitle }: Props) {
  return (
    <View style={styles.heroSection}>
      <Image
        source={require('../../assets/backgrounds/training-bg.jpg')}
        style={styles.heroImage}
        contentFit="cover"
      />
      <LinearGradient
        colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.55)', 'rgba(13,0,21,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroOverlay}>
        <Text style={styles.heroEyebrow}>✦ Psychic Mastery ✦</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <View style={styles.heroGlyphRow}>
          <View style={styles.heroGlyphLine} />
          <Ionicons
            name="sparkles"
            size={11}
            color="#fbbf24"
            style={{ marginHorizontal: 8 }}
          />
          <View style={styles.heroGlyphLine} />
        </View>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroSection: { height: 180, position: 'relative', overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#fbbf24',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroGlyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  heroGlyphLine: {
    width: 32,
    height: 1,
    backgroundColor: 'rgba(251,191,36,0.6)',
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#c4b5fd',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
