/**
 * SubscriptionOnlyBanner — the single unified "this content requires a paid
 * subscription" indicator used across the app. Replaces all ad-hoc "Premium
 * Only" / "Premium feature" badges and banners so paywalled content speaks
 * with one voice.
 *
 * Two visual variants are provided:
 *   - 'badge'  — small inline pill (use on cards / section headers)
 *   - 'banner' — full-width row with a Tap-to-Upgrade CTA
 *
 * Tapping either takes the user to /settings where they can subscribe.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type Variant = 'badge' | 'banner';

interface Props {
  variant?: Variant;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  /** Optional override label — defaults to "SUBSCRIPTION ONLY" / "Subscription Only — tap to unlock" */
  label?: string;
}

export const SubscriptionOnlyBanner: React.FC<Props> = ({
  variant = 'badge',
  onPress,
  style,
  label,
}) => {
  const router = useRouter();
  const handlePress = () => {
    if (onPress) onPress();
    else router.push('/settings');
  };

  if (variant === 'badge') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.badge, style as ViewStyle]}
        accessibilityRole="button"
        accessibilityLabel={label || 'Subscription only — tap to upgrade'}
      >
        <Ionicons name="lock-closed" size={11} color="#fbbf24" style={styles.badgeIcon} />
        <Text style={styles.badgeText}>{label || 'SUBSCRIPTION ONLY'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[styles.banner, style as ViewStyle]}
      accessibilityRole="button"
      accessibilityLabel={label || 'Subscription only — tap to unlock'}
    >
      <Ionicons name="lock-closed" size={18} color="#fbbf24" />
      <Text style={styles.bannerText}>{label || 'Subscription Only — tap to unlock'}</Text>
      <Ionicons name="chevron-forward" size={18} color="#fbbf24" style={styles.bannerChevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // --- Compact badge (for cards / section headers) ---
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.55)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.9,
  },

  // --- Full-width banner (for top-of-screen / list footers) ---
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderColor: 'rgba(251, 191, 36, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
  },
  bannerText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bannerChevron: {
    marginLeft: 4,
  },
});

export default SubscriptionOnlyBanner;
