/**
 * StarField - Cheap, decorative animated stars that twinkle.
 * Uses Reanimated shared values, no continuous JS work.
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
} from 'react-native-reanimated';

interface Star {
  id: number;
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

interface StarFieldProps {
  count?: number;
  style?: StyleProp<ViewStyle>;
  width?: number;
  height?: number;
  goldRatio?: number; // fraction of stars rendered gold
}

const seededRandom = (seed: number) => {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export const StarField: React.FC<StarFieldProps> = ({
  count = 30,
  style,
  width = 100,
  height = 100,
  goldRatio = 0.15,
}) => {
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: count }).map((_, i) => {
      const r1 = seededRandom(i + 1);
      const r2 = seededRandom(i + 99);
      const r3 = seededRandom(i + 17);
      const isGold = r3 < goldRatio;
      return {
        id: i,
        top: r1 * 100,
        left: r2 * 100,
        size: 1 + seededRandom(i + 51) * 2.5,
        delay: Math.floor(seededRandom(i + 7) * 3000),
        duration: 1800 + Math.floor(seededRandom(i + 23) * 2200),
        color: isGold ? '#fcd34d' : '#ffffff',
      };
    });
  }, [count, goldRatio]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {stars.map((s) => (
        <Twinkle key={s.id} star={s} />
      ))}
    </View>
  );
};

const Twinkle: React.FC<{ star: Star }> = ({ star }) => {
  const opacity = useSharedValue(0.2);

  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withTiming(1, { duration: star.duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [opacity, star.delay, star.duration]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: `${star.top}%`,
          left: `${star.left}%`,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.color,
          shadowColor: star.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: star.size * 2,
        },
        animatedStyle,
      ]}
    />
  );
};

export default StarField;
