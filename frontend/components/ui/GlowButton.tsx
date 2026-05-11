/**
 * GlowButton - Primary mystical CTA with gradient fill, gold border accent, and haptic feedback.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { palette, radii, spacing, shadows, typography } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger';

interface GlowButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

const GRADIENTS: Record<Variant, readonly [string, string, ...string[]]> = {
  primary: ['#a855f7', '#7c3aed', '#5b21b6'] as const,
  secondary: ['rgba(168,85,247,0.20)', 'rgba(124,58,237,0.10)'] as const,
  gold: ['#fcd34d', '#fbbf24', '#d97706'] as const,
  ghost: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] as const,
  danger: ['#f87171', '#ef4444', '#b91c1c'] as const,
};

const BORDER: Record<Variant, string> = {
  primary: 'rgba(251, 191, 36, 0.55)',
  secondary: 'rgba(183, 148, 246, 0.45)',
  gold: 'rgba(255, 255, 255, 0.7)',
  ghost: 'rgba(183, 148, 246, 0.30)',
  danger: 'rgba(255, 255, 255, 0.5)',
};

const LABEL_COLOR: Record<Variant, string> = {
  primary: '#fff',
  secondary: palette.iceLavender,
  gold: '#1a0033',
  ghost: palette.mist,
  danger: '#fff',
};

export const GlowButton: React.FC<GlowButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  size = 'md',
  disabled,
  loading,
  fullWidth,
  style,
  labelStyle,
}) => {
  const padV = size === 'sm' ? 10 : size === 'lg' ? 16 : 13;
  const padH = size === 'sm' ? 14 : size === 'lg' ? 28 : 22;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  const shadow = variant === 'gold' ? shadows.glowGold : variant === 'primary' ? shadows.glow : shadows.glowSoft;

  const handlePress = () => {
    if (disabled || loading) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.wrapper,
        fullWidth && { alignSelf: 'stretch' },
        shadow,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      <LinearGradient
        colors={GRADIENTS[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          { paddingVertical: padV, paddingHorizontal: padH, borderColor: BORDER[variant] },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={LABEL_COLOR[variant]} />
        ) : (
          <View style={styles.row}>
            {icon && (
              <Ionicons name={icon} size={fontSize + 3} color={LABEL_COLOR[variant]} style={{ marginRight: 8 }} />
            )}
            <Text style={[styles.label, { color: LABEL_COLOR[variant], fontSize }, labelStyle]}>{label}</Text>
            {iconRight && (
              <Ionicons name={iconRight} size={fontSize + 3} color={LABEL_COLOR[variant]} style={{ marginLeft: 8 }} />
            )}
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

export default GlowButton;
