/**
 * QuantumWaveform — a tiny animated waveform + time indicator shown on the
 * Oracle Chat speaker button while audio is playing.
 *
 * The player is polled every ~250ms for currentTime/duration. When the
 * component is `active`, five vertical bars pulse independently to give a
 * subtle "audio playing" affordance next to the stop button.
 *
 * Props:
 *   active      — true while this bubble's audio is playing
 *   currentTime — seconds elapsed (defaults to 0)
 *   duration    — total seconds (defaults to 0 → shows "--:--")
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  active: boolean;
  currentTime?: number;
  duration?: number;
  color?: string;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

function Bar({
  active,
  delay,
  color,
}: {
  active: boolean;
  delay: number;
  color: string;
}) {
  const h = useSharedValue(6);
  useEffect(() => {
    if (active) {
      h.value = withDelay(
        delay,
        withRepeat(
          withTiming(14, {
            duration: 380,
            easing: Easing.inOut(Easing.quad),
          }),
          -1,
          true,
        ),
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(4, { duration: 180 });
    }
    return () => {
      cancelAnimation(h);
    };
  }, [active, delay, h]);

  const style = useAnimatedStyle(() => ({
    height: h.value,
  }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export default function QuantumWaveform({
  active,
  currentTime = 0,
  duration = 0,
  color = '#fbbf24',
}: Props) {
  const showDuration = duration > 0 && Number.isFinite(duration);
  return (
    <View style={styles.wrap}>
      <View style={styles.barsRow}>
        <Bar active={active} delay={0} color={color} />
        <Bar active={active} delay={90} color={color} />
        <Bar active={active} delay={180} color={color} />
        <Bar active={active} delay={140} color={color} />
        <Bar active={active} delay={60} color={color} />
      </View>
      <Text style={styles.time}>
        {fmt(currentTime)}
        {showDuration ? ` / ${fmt(duration)}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 6,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 16,
  },
  bar: {
    width: 2,
    borderRadius: 1,
    minHeight: 4,
  },
  time: {
    color: '#c4b5fd',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
