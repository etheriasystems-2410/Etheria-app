/**
 * MysticalHeader - Page-level hero with title + optional subtitle, gold underline glyph,
 * starfield, and a back/menu button.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { palette, spacing, typography, radii } from '../../theme/tokens';
import StarField from './StarField';

interface MysticalHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export const MysticalHeader: React.FC<MysticalHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  showBack,
  onBack,
  right,
  style,
  compact,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  return (
    <View style={[styles.container, compact && { paddingVertical: spacing.lg }, style]}>
      <LinearGradient
        colors={['rgba(168,85,247,0.18)', 'rgba(26,0,51,0.0)']}
        style={StyleSheet.absoluteFill}
      />
      <StarField count={18} goldRatio={0.25} />

      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={palette.iceLavender} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtnPlaceholder} />
        )}
        <View style={{ flex: 1 }} />
        {right ? right : <View style={styles.iconBtnPlaceholder} />}
      </View>

      <View style={styles.titleWrap}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.glyphRow}>
          <View style={styles.glyphLine} />
          <Ionicons name="sparkles" size={12} color={palette.gold} style={{ marginHorizontal: 8 }} />
          <View style={styles.glyphLine} />
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(183,148,246,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPlaceholder: { width: 40, height: 40 },
  titleWrap: { alignItems: 'center' },
  eyebrow: {
    ...typography.eyebrow,
    color: palette.gold,
    marginBottom: 6,
  },
  title: {
    ...typography.h1,
    color: palette.starWhite,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  glyphLine: {
    width: 38,
    height: 1,
    backgroundColor: 'rgba(251,191,36,0.55)',
  },
  subtitle: {
    ...typography.body,
    color: palette.mist,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 4,
  },
});

export default MysticalHeader;
