/**
 * CompanionHeaderButton — a small chat-bubble icon that sits in the drawer
 * header on every screen. Always visible for premium users so they can reach
 * their Companion Guide from anywhere, even when the floating bubble is
 * hidden (on auth screens, on web, or when they haven't yet chosen a guide).
 *
 * Tap → routes to /spirit-guides (if a guide is chosen) or the guide picker.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { useCompanionGuide } from '../hooks/useCompanionGuide';

export default function CompanionHeaderButton() {
  const router = useRouter();
  const { isAuthenticated, isPremium } = useAuth();
  const { state } = useCompanionGuide();

  // Only surface for authenticated premium users. Free users see nothing here
  // (they'd get bounced to the paywall which is a poor header-tap experience).
  if (!isAuthenticated || !isPremium) return null;

  const hasUnread = !!state.whisper;
  const hasGuide = !!state.companion;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() =>
        router.push(
          hasGuide
            ? (`/spirit-guides?guide=${encodeURIComponent(state.companion!)}` as any)
            : '/spirit-guides'
        )
      }
      accessibilityLabel={
        hasGuide ? `Chat with ${state.companion}` : 'Choose a Companion Guide'
      }
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={hasGuide ? 'chatbubble' : 'chatbubble-outline'}
        size={22}
        color="#fbbf24"
      />
      {hasUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 4,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ec4899',
    borderWidth: 1.5,
    borderColor: '#0d0015',
  },
});
