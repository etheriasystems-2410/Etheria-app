/**
 * CompanionBubble — a draggable, edge-snapping floating avatar of the user's
 * selected Companion Guide. Lives at the root layout so it persists across
 * every screen in the app.
 *
 * Behaviors:
 *   • Drag anywhere → snaps to the nearest screen edge on release
 *   • Tap → routes to /spirit-guides?guide=NAME (opens chat with that guide)
 *   • Long-press → shows a small whisper bubble + Hide button
 *   • Subtle ambient pulse while a fresh whisper is unread
 *   • Persists last position in AsyncStorage so it stays where you put it
 *
 * Visibility:
 *   • Only rendered when the user is authenticated, premium, AND has chosen
 *     a Companion (see useCompanionGuide).
 *   • Hidden on auth screens to avoid covering input fields.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { useCompanionGuide } from '../hooks/useCompanionGuide';
import { guides, Guide } from '../constants/guides';

const BUBBLE_SIZE = 56;
const EDGE_PADDING = 8;
const POS_STORAGE_KEY = 'companion_bubble_pos_v1';
const WHISPER_AUTO_HIDE_MS = 6500;

// Screens where the bubble should hide so it doesn't cover critical UI
const HIDDEN_SEGMENTS: Record<string, true> = {
  auth: true,
  'auth/login': true,
  'auth/signup': true,
  'auth/callback': true,
};

function findGuideByName(name: string | null, customNames: { male: string; female: string }): Guide | null {
  if (!name) return null;
  // Direct match in the base catalogue (covers all elemental/lgbtq/divine)
  const direct = guides.find((g) => g.name === name);
  if (direct) return direct;
  // Renamed custom guides
  if (name === customNames.male) return guides.find((g) => g.custom_slot === 'male') || null;
  if (name === customNames.female) return guides.find((g) => g.custom_slot === 'female') || null;
  // Default fallback: treat unknown as the male custom slot so we still
  // render a sensible avatar
  return guides.find((g) => g.custom_slot === 'male') || null;
}

export default function CompanionBubble() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isPremium } = useAuth();
  const { state, fetchNewWhisper } = useCompanionGuide();

  const [customNames, setCustomNames] = useState({ male: 'Male Guide', female: 'Female Guide' });
  const [whisperVisible, setWhisperVisible] = useState(false);
  const whisperHideTimer = useRef<any>(null);
  const lastSeenWhisperAt = useRef<string | null>(null);

  // Load renamed custom-guide names so the bubble matches a renamed guide
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('custom_guide_names_v1');
        if (raw) setCustomNames(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  // ----- Position state (persisted) -----------------------------------------
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
  const initialX = SCREEN_W - BUBBLE_SIZE - EDGE_PADDING;
  const initialY = SCREEN_H * 0.55;
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const lastPos = useRef({ x: initialX, y: initialY });

  // Load saved position once
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(POS_STORAGE_KEY);
        if (raw) {
          const { x, y } = JSON.parse(raw);
          const safeX = Math.max(EDGE_PADDING, Math.min(SCREEN_W - BUBBLE_SIZE - EDGE_PADDING, x));
          const safeY = Math.max(80, Math.min(SCREEN_H - BUBBLE_SIZE - 100, y));
          pan.setValue({ x: safeX, y: safeY });
          lastPos.current = { x: safeX, y: safeY };
        }
      } catch {}
    })();
  }, [SCREEN_W, SCREEN_H, pan]);

  // ----- Ambient pulse while a fresh whisper is unread ----------------------
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasFreshWhisper = !!state.whisper && lastSeenWhisperAt.current !== state.whisper_at;

  useEffect(() => {
    if (!hasFreshWhisper) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasFreshWhisper, pulseAnim]);

  // ----- Pan responder ------------------------------------------------------
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          isDraggingRef.current = false;
          dragStartRef.current = { ...lastPos.current };
          // @ts-ignore — Animated.ValueXY extra method
          pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_evt, gesture) => {
          if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) {
            isDraggingRef.current = true;
          }
          pan.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_evt, gesture) => {
          pan.flattenOffset();
          const finalX = dragStartRef.current.x + gesture.dx;
          const finalY = dragStartRef.current.y + gesture.dy;

          // Snap to nearest edge horizontally
          const snapX =
            finalX + BUBBLE_SIZE / 2 < SCREEN_W / 2
              ? EDGE_PADDING
              : SCREEN_W - BUBBLE_SIZE - EDGE_PADDING;
          const clampedY = Math.max(
            80,
            Math.min(SCREEN_H - BUBBLE_SIZE - 100, finalY),
          );

          Animated.spring(pan, {
            toValue: { x: snapX, y: clampedY },
            useNativeDriver: false,
            bounciness: 8,
            speed: 14,
          }).start();
          lastPos.current = { x: snapX, y: clampedY };
          AsyncStorage.setItem(POS_STORAGE_KEY, JSON.stringify(lastPos.current)).catch(() => {});

          // If user barely moved → treat as tap
          if (!isDraggingRef.current) {
            handleTap();
          }
        },
      }),
    [SCREEN_W, SCREEN_H, pan, state],
  );

  // ----- Tap behavior -------------------------------------------------------
  const handleTap = () => {
    if (!state.companion) return;
    lastSeenWhisperAt.current = state.whisper_at;
    setWhisperVisible(true);
    if (whisperHideTimer.current) clearTimeout(whisperHideTimer.current);
    whisperHideTimer.current = setTimeout(() => setWhisperVisible(false), WHISPER_AUTO_HIDE_MS);
  };

  const openChat = () => {
    setWhisperVisible(false);
    if (!state.companion) return;
    router.push({
      pathname: '/spirit-guides',
      params: { guide: state.companion },
    } as any);
  };

  const refreshWhisper = async () => {
    await fetchNewWhisper();
  };

  // ----- Visibility guards --------------------------------------------------
  // Hide on auth screens, hide when not authenticated, hide when no
  // companion selected, hide when not premium.
  const segKey = segments.slice(0, 2).join('/');
  const onAuthScreen =
    HIDDEN_SEGMENTS[segments[0] as string] || HIDDEN_SEGMENTS[segKey];

  if (Platform.OS === 'web') return null; // web preview keeps things calm
  if (!isAuthenticated || !isPremium || !state.companion || onAuthScreen) {
    return null;
  }

  const guide = findGuideByName(state.companion, customNames);
  if (!guide) return null;

  const bubblePosition = pan.getLayout();

  // For the whisper bubble — anchor on whichever side the bubble is on
  const isOnLeft = lastPos.current.x < (SCREEN_W - BUBBLE_SIZE) / 2;

  return (
    <>
      {/* Whisper popup */}
      {whisperVisible && state.whisper && (
        <Animated.View
          style={[
            styles.whisperBubble,
            {
              top: lastPos.current.y - 6,
              left: isOnLeft ? lastPos.current.x + BUBBLE_SIZE + 8 : undefined,
              right: isOnLeft ? undefined : SCREEN_W - lastPos.current.x + 8,
              borderColor: guide.color,
            },
          ]}
        >
          <Text style={styles.whisperGuideName}>{guide.name}</Text>
          <Text style={styles.whisperText}>{state.whisper}</Text>
          <View style={styles.whisperActions}>
            <TouchableOpacity onPress={openChat} style={[styles.whisperBtn, { backgroundColor: guide.color + '33' }]}>
              <Ionicons name="chatbubble" size={12} color={guide.color} />
              <Text style={[styles.whisperBtnText, { color: guide.color }]}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={refreshWhisper} style={styles.whisperBtnGhost}>
              <Ionicons name="refresh" size={12} color="#e9d5ff" />
              <Text style={styles.whisperBtnGhostText}>New whisper</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Bubble */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.bubble,
          bubblePosition,
          {
            transform: [...bubblePosition.transform, { scale: pulseAnim }],
            borderColor: guide.color,
            shadowColor: guide.color,
          },
        ]}
      >
        <Pressable onPress={handleTap} onLongPress={openChat} style={styles.bubbleInner}>
          {guide.image ? (
            <Image source={guide.image} style={styles.bubbleImage} resizeMode="cover" />
          ) : (
            <View style={[styles.bubbleFallback, { backgroundColor: guide.color }]}>
              <Ionicons name={(guide.icon as any) || 'sparkles'} size={24} color="#fff" />
            </View>
          )}
          {hasFreshWhisper && <View style={[styles.unreadDot, { backgroundColor: guide.color }]} />}
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    overflow: 'visible',
    borderWidth: 2,
    backgroundColor: '#1a0a2e',
    // Glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 9999,
  },
  bubbleInner: {
    width: '100%',
    height: '100%',
    borderRadius: BUBBLE_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleImage: {
    width: '100%',
    height: '100%',
  },
  bubbleFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0a0014',
  },
  whisperBubble: {
    position: 'absolute',
    maxWidth: 240,
    backgroundColor: 'rgba(15, 5, 35, 0.97)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    zIndex: 10000,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 14,
  },
  whisperGuideName: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  whisperText: {
    color: '#e9d5ff',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  whisperActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  whisperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  whisperBtnText: { fontSize: 11, fontWeight: '700' },
  whisperBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(233, 213, 255, 0.08)',
  },
  whisperBtnGhostText: { fontSize: 11, color: '#e9d5ff' },
});
