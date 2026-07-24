/**
 * CertificateProgressRing — beautiful circular progress ring used inside the
 * Training modules to show how close the student is to earning a
 * "Certificate of Awakening" for the given module.
 *
 * Two modes:
 *   • compact  → small inline ring used at the top of the LessonListModal
 *   • full     → larger ring used inside the LessonWorkbook
 *
 * When the certificate is earned, the ring turns gold and pulses subtly.
 * Tapping the ring (or the CTA button) opens the CertificateModal.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export interface CertificateData {
  module_id: string;
  module_title: string;
  earned: boolean;
  threshold_pct: number;
  average_pct: number;
  lessons_taken: number;
  lessons_total: number;
  per_lesson_pct?: Record<string, number>;
}

interface Props {
  cert: CertificateData;
  variant?: 'compact' | 'full';
  onPress?: () => void;
}

const RING_SIZE = { compact: 72, full: 120 };
const STROKE = { compact: 7, full: 10 };

export default function CertificateProgressRing({
  cert,
  variant = 'full',
  onPress,
}: Props) {
  const size = RING_SIZE[variant];
  const stroke = STROKE[variant];
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const pct = Math.max(0, Math.min(100, cert.average_pct || 0));
  const dashOffset = circumference * (1 - pct / 100);

  // Gentle pulse when earned
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (cert.earned) {
      pulse.value = withRepeat(
        withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
    return () => {
      cancelAnimation(pulse);
    };
  }, [cert.earned, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const ringColor = cert.earned ? '#fbbf24' : '#a855f7';
  const bgTrack = 'rgba(45,27,78,0.85)';

  const subtitle = cert.earned
    ? 'Certificate earned'
    : cert.lessons_taken === 0
    ? 'Start a quiz to begin'
    : `${cert.lessons_taken}/${cert.lessons_total} lessons quizzed`;

  const helper = cert.earned
    ? 'Tap to view your certificate'
    : `Need ${cert.threshold_pct}% average across all lessons`;

  const Body = (
    <View style={variant === 'compact' ? styles.wrapCompact : styles.wrapFull}>
      <Animated.View style={[styles.ringWrap, animatedStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinearGradient id={`grad-${cert.module_id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={cert.earned ? '#fde68a' : '#c084fc'} stopOpacity="1" />
              <Stop offset="1" stopColor={ringColor} stopOpacity="1" />
            </SvgLinearGradient>
          </Defs>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgTrack}
            strokeWidth={stroke}
            fill="none"
          />
          {/* Progress arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#grad-${cert.module_id})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={StyleSheet.absoluteFillObject as any}>
          <View style={styles.center}>
            {cert.earned ? (
              <Ionicons
                name="ribbon"
                size={variant === 'compact' ? 22 : 34}
                color="#fbbf24"
              />
            ) : (
              <>
                <Text
                  style={[
                    styles.pct,
                    variant === 'compact' && { fontSize: 16 },
                  ]}
                >
                  {pct}%
                </Text>
                {variant === 'full' && (
                  <Text style={styles.pctSub}>avg score</Text>
                )}
              </>
            )}
          </View>
        </View>
      </Animated.View>

      <View style={styles.textCol}>
        <Text
          style={[styles.title, variant === 'compact' && { fontSize: 13 }]}
          numberOfLines={1}
        >
          {cert.earned ? 'Certificate of Awakening' : 'Certificate Progress'}
        </Text>
        <Text
          style={[styles.subtitle, variant === 'compact' && { fontSize: 11 }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
        <Text
          style={[styles.helper, variant === 'compact' && { fontSize: 10 }]}
          numberOfLines={2}
        >
          {helper}
        </Text>
        {cert.earned && (
          <View style={styles.earnedPill}>
            <Ionicons name="sparkles" size={11} color="#0f0321" />
            <Text style={styles.earnedPillText}>View certificate</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.card,
          cert.earned && styles.cardEarned,
        ]}
      >
        {Body}
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.card, cert.earned && styles.cardEarned]}>{Body}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(30,14,58,0.65)',
    padding: 12,
    shadowColor: '#a855f7',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardEarned: {
    borderColor: 'rgba(251,191,36,0.7)',
    backgroundColor: 'rgba(58,42,14,0.55)',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.55,
  },
  wrapFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  wrapCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    color: '#e9d5ff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pctSub: {
    color: '#c4b5fd',
    fontSize: 9,
    marginTop: 1,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    color: '#e9d5ff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: { color: '#c4b5fd', fontSize: 12, marginTop: 2 },
  helper: {
    color: '#7c6ba0',
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  earnedPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fbbf24',
  },
  earnedPillText: { color: '#0f0321', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
});
