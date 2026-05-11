/**
 * GlassCard - A frosted-glass card with a subtle gradient border and inner glow.
 * Falls back gracefully on platforms where BlurView is limited.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, radii, spacing, shadows } from '../../theme/tokens';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  variant?: 'default' | 'gold' | 'strong';
  padded?: boolean;
  noBorder?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 22,
  variant = 'default',
  padded = true,
  noBorder = false,
}) => {
  const borderColor =
    variant === 'gold'
      ? palette.goldBorder
      : variant === 'strong'
      ? palette.glassBorderStrong
      : palette.glassBorder;

  const fillGradient =
    variant === 'gold'
      ? (['rgba(251,191,36,0.10)', 'rgba(124,58,237,0.04)'] as const)
      : variant === 'strong'
      ? (['rgba(168,85,247,0.24)', 'rgba(124,58,237,0.06)'] as const)
      : (['rgba(168,85,247,0.16)', 'rgba(124,58,237,0.04)'] as const);

  return (
    <View
      style={[
        styles.wrapper,
        !noBorder && { borderColor, borderWidth: 1 },
        shadows.glowSoft,
        style,
      ]}
    >
      {Platform.OS !== 'web' && (
        <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={fillGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[padded && styles.inner]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: 'rgba(26, 10, 46, 0.55)',
  },
  inner: {
    padding: spacing.md,
  },
});

export default GlassCard;
