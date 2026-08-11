/**
 * SessionDrawer — a slide-in-from-left overlay panel that hosts the
 * reprogramming session's ancillary controls (session length, voice /
 * music-bed volume, Light Therapy). Moving these out of the main player
 * area declutters the on-screen visuals so the mystical layer + timer
 * stay dominant while playing.
 *
 * Usage:
 *   <SessionDrawer visible={open} onClose={() => setOpen(false)}>
 *     <SessionDrawerSection title="Session Length">…</SessionDrawerSection>
 *     …
 *   </SessionDrawer>
 *
 * Behaviour:
 *   • Slides in from the left, taking ~82 % of the screen width.
 *   • Tapping the dimmed backdrop closes the drawer.
 *   • Content scrolls if it overflows.
 *   • Uses Reanimated for a native-driver-friendly slide.
 */
import React, { ReactNode, useEffect } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.round(Math.min(SCREEN_WIDTH * 0.86, 380));

interface SessionDrawerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  accentColor?: string;
  children: ReactNode;
}

export default function SessionDrawer({
  visible,
  onClose,
  title = 'Session Options',
  accentColor = '#fbbf24',
  children,
}: SessionDrawerProps) {
  // 0 = fully closed (off-screen), 1 = fully open
  const progress = useSharedValue(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
  }, [visible, progress]);

  const panelStyle = useAnimatedStyle(() => {
    const tx = interpolate(progress.value, [0, 1], [-DRAWER_WIDTH, 0]);
    return { transform: [{ translateX: tx }] };
  });
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.7,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dimmed backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sliding panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            width: DRAWER_WIDTH,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
          panelStyle,
        ]}
      >
        <LinearGradient
          colors={['#1a0033', '#0f0321', '#0a0018']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="options" size={20} color={accentColor} />
            <Text style={[styles.headerTitle, { color: accentColor }]}>
              {title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color="#e9d5ff" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerAccent}>
          <View
            style={[styles.headerAccentLine, { backgroundColor: accentColor }]}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/**
 * A titled section inside the drawer. Wraps its children with consistent
 * spacing, a section label, and a subtle divider above.
 */
export function SessionDrawerSection({
  title,
  icon,
  accentColor = '#fbbf24',
  children,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon ? (
          <Ionicons name={icon} size={13} color={accentColor} />
        ) : null}
        <Text style={[styles.sectionTitle, { color: accentColor }]}>
          {title}
        </Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderRightWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 4,
  },
  headerAccent: {
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  headerAccentLine: {
    height: 1.5,
    width: 42,
    borderRadius: 1,
    opacity: 0.75,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 18,
  },
  section: {
    backgroundColor: 'rgba(15,3,33,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionBody: {
    gap: 8,
  },
});
