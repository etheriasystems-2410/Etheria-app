/**
 * LessonHeroBanner — small reusable hero image dropped at the top of every
 * lesson / lesson-list / workbook page in both Psychic Training and Astral
 * Travel Self-Study.
 *
 * A single nebula-scape provides visual "breathing room" so the content
 * below never sits flush against the phone's notch / dynamic island.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Single reusable hero image shared across every lesson page.
const HERO_IMAGE = {
  uri: 'https://customer-assets-gfyr7b9c.emergentagent.net/job_a75d84fa-0948-4f28-9189-c803d31a5037/artifacts/sci4bka1_26123.png',
};

interface Props {
  title?: string;
  eyebrow?: string;
  height?: number;
}

export default function LessonHeroBanner({
  title,
  eyebrow,
  height = 140,
}: Props) {
  return (
    <View style={[styles.banner, { height }]}>
      <Image
        source={HERO_IMAGE}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.35)', 'rgba(13,0,21,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.overlay}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        {title ? (
          <>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.glyphRow}>
              <View style={styles.glyphLine} />
              <Ionicons
                name="sparkles"
                size={10}
                color="#fbbf24"
                style={{ marginHorizontal: 6 }}
              />
              <View style={styles.glyphLine} />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: '#fbbf24',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  glyphLine: {
    width: 26,
    height: 1,
    backgroundColor: 'rgba(251,191,36,0.55)',
  },
});
