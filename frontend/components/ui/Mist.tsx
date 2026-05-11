/**
 * Mist - Drifting cosmic mist clouds. Soft translucent blobs that slowly
 * float across the screen with gentle opacity and position animation.
 * Replaces the starfield for a more ethereal feel.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface Blob {
  id: number;
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  tint: string;
}

interface MistProps {
  count?: number;
  style?: StyleProp<ViewStyle>;
  intensity?: 'soft' | 'medium' | 'strong';
}

const seeded = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const TINTS = [
  'rgba(183, 148, 246, 0.18)', // lavender
  'rgba(168, 85, 247, 0.15)',  // amethyst
  'rgba(124, 58, 237, 0.12)',  // deep amethyst
  'rgba(232, 213, 255, 0.10)', // ice lavender
  'rgba(251, 191, 36, 0.06)',  // subtle gold
];

export const Mist: React.FC<MistProps> = ({ count = 8, style, intensity = 'medium' }) => {
  const opacityMultiplier =
    intensity === 'soft' ? 0.6 : intensity === 'strong' ? 1.4 : 1.0;

  const blobs = useMemo<Blob[]>(() => {
    return Array.from({ length: count }).map((_, i) => {
      const r1 = seeded(i + 1);
      const r2 = seeded(i + 99);
      const r3 = seeded(i + 17);
      const r4 = seeded(i + 43);
      return {
        id: i,
        top: r1 * 100,
        left: r2 * 100,
        size: 180 + r3 * 260,
        delay: Math.floor(r4 * 4000),
        duration: 9000 + Math.floor(seeded(i + 23) * 7000),
        drift: 40 + seeded(i + 51) * 80,
        tint: TINTS[Math.floor(seeded(i + 67) * TINTS.length)],
      };
    });
  }, [count]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      {blobs.map((b) => (
        <MistBlob key={b.id} blob={b} opacityMultiplier={opacityMultiplier} />
      ))}
    </View>
  );
};

const MistBlob: React.FC<{ blob: Blob; opacityMultiplier: number }> = ({ blob, opacityMultiplier }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      blob.delay,
      withRepeat(
        withTiming(1, { duration: blob.duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );
  }, [progress, blob.delay, blob.duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const tx = interpolate(progress.value, [0, 1], [-blob.drift / 2, blob.drift / 2]);
    const ty = interpolate(progress.value, [0, 1], [blob.drift / 3, -blob.drift / 3]);
    const op = interpolate(progress.value, [0, 0.5, 1], [0.3, 0.9, 0.3]);
    return {
      opacity: op * opacityMultiplier,
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: `${blob.top}%`,
          left: `${blob.left}%`,
          width: blob.size,
          height: blob.size,
          borderRadius: blob.size / 2,
          backgroundColor: blob.tint,
          marginTop: -blob.size / 2,
          marginLeft: -blob.size / 2,
        },
        animatedStyle,
      ]}
    />
  );
};

export default Mist;
