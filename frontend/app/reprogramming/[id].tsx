/**
 * Reprogramming session player.
 *
 * Polish v2 — includes:
 *  • Skip / rewind controls (±15s) that wrap loop boundaries safely.
 *  • Per-topic radial gradient behind the icon halo, using the session
 *    color (from the backend catalog).
 *  • Persists the user's preferred duration per session in AsyncStorage
 *    so the next visit defaults to their last choice.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CosmicBackdrop } from '../../components/ui';
import { AudioPlayerManager } from '../../utils/audioPlayer';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const DEFAULT_DURATIONS = [10, 20, 30, 45, 60];
const PLAY_VOLUME = 0.9;
const SKIP_SECONDS = 15;
const STORAGE_KEY = (id: string) => `reprogramming:duration:${id}`;

interface SessionMeta {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  is_free: boolean;
  locked: boolean;
  duration_presets?: number[];
}

/** Convert a hex like "#a855f7" to an rgba() string with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const short = h.length === 3;
  const r = parseInt(short ? h[0] + h[0] : h.substring(0, 2), 16);
  const g = parseInt(short ? h[1] + h[1] : h.substring(2, 4), 16);
  const b = parseInt(short ? h[2] + h[2] : h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function ReprogrammingSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [selectedDuration, setSelectedDuration] = useState<number>(20);

  const [starting, setStarting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const playerRef = useRef<AudioPlayerManager | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------- Load session metadata + persisted duration ----------------
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('session_token');
        const r = await fetch(
          `${BACKEND_URL}/api/reprogramming/session/${id}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        );
        const data = await r.json();
        if (!r.ok) throw new Error(data?.detail || 'Could not load session');
        setMeta(data);

        // Restore last-picked duration for this session
        const saved = await AsyncStorage.getItem(STORAGE_KEY(String(id)));
        const validSet = new Set(
          (data.duration_presets as number[] | undefined) || DEFAULT_DURATIONS,
        );
        if (saved && validSet.has(Number(saved))) {
          setSelectedDuration(Number(saved));
        } else {
          setSelectedDuration(20);
        }
      } catch (e: any) {
        setMetaError(e?.message || 'Could not load session');
      } finally {
        setMetaLoading(false);
      }
    })();
  }, [id]);

  // ---------------- Cleanup on unmount ----------------
  useEffect(() => {
    return () => {
      try {
        playerRef.current?.unload();
      } catch {}
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, []);

  const clearTimers = () => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  };

  const scheduleFadeOut = (durationMinutes: number) => {
    clearTimers();
    const totalMs = durationMinutes * 60 * 1000;
    const fadeLeadMs = 30_000;
    const fadeStartAt = Math.max(totalMs - fadeLeadMs, 5000);

    fadeTimerRef.current = setTimeout(async () => {
      try {
        const steps = 30;
        for (let i = steps; i >= 0; i -= 1) {
          const v = (PLAY_VOLUME * i) / steps;
          await playerRef.current?.setVolume(Math.max(0, v));
          await new Promise((r) => setTimeout(r, 1000));
        }
        await playerRef.current?.unload();
      } catch {}
      setPlaying(false);
      setSessionActive(false);
    }, fadeStartAt);

    tickIntervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  const persistDuration = async (mins: number) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY(String(id)), String(mins));
    } catch {
      // best-effort persistence
    }
  };

  const pickDuration = (mins: number) => {
    setSelectedDuration(mins);
    persistDuration(mins);
  };

  const startSession = async () => {
    if (!meta || meta.locked) return;

    setStarting(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const r = await fetch(
        `${BACKEND_URL}/api/reprogramming/audio-base64/${meta.id}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 402) {
          Alert.alert(
            'Premium Only',
            'This session requires an Etheria Premium subscription.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: () => router.push('/settings') },
            ],
          );
          return;
        }
        throw new Error(data?.detail || 'Could not start session');
      }

      const uri = `data:audio/mp3;base64,${data.audio_base64}`;
      const player = new AudioPlayerManager();
      await player.loadAndPlay(uri, { loop: true, volume: PLAY_VOLUME });
      playerRef.current = player;

      setElapsedSeconds(0);
      setPlaying(true);
      setSessionActive(true);
      scheduleFadeOut(selectedDuration);
    } catch (e: any) {
      Alert.alert(
        'Playback error',
        e?.message || 'Could not start the session. Please try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  const togglePlay = async () => {
    if (!playerRef.current) return;
    try {
      if (playing) {
        await playerRef.current.pause();
        setPlaying(false);
      } else {
        await playerRef.current.play();
        setPlaying(true);
      }
    } catch (e: any) {
      Alert.alert('Playback error', e?.message || 'Please try again');
    }
  };

  const skip = async (deltaSeconds: number) => {
    if (!playerRef.current) return;
    try {
      // Manual wrap because the narration loops — if we seek past the end,
      // we simply restart from the beginning (or seek back to a safe point).
      const dur = playerRef.current.getDuration() ?? 0;
      const cur = playerRef.current.getCurrentTime() ?? 0;
      let target = cur + deltaSeconds;
      if (dur > 0) {
        if (target < 0) target = 0;
        if (target >= dur - 0.5) target = dur > 5 ? dur - 5 : 0;
      } else if (target < 0) {
        target = 0;
      }
      await playerRef.current.seekTo(target);
    } catch {
      // ignore transient seek errors
    }
  };

  const endSession = async () => {
    clearTimers();
    try {
      await playerRef.current?.unload();
    } catch {}
    setPlaying(false);
    setSessionActive(false);
    router.back();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const durations = meta?.duration_presets?.length
    ? meta.duration_presets
    : DEFAULT_DURATIONS;

  const themeColor = meta?.color || '#7c3aed';

  // ---------------- RENDER ----------------
  return (
    <CosmicBackdrop>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={endSession} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {meta?.title || 'Session'}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        {metaLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#a855f7" />
          </View>
        ) : metaError ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle" size={40} color="#ef4444" />
            <Text style={styles.errorText}>{metaError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={endSession}>
              <Text style={styles.retryText}>Back</Text>
            </TouchableOpacity>
          </View>
        ) : meta?.locked ? (
          <View style={styles.center}>
            <Ionicons name="lock-closed" size={40} color="#fbbf24" />
            <Text style={styles.lockedTitle}>Premium Session</Text>
            <Text style={styles.lockedBody}>
              Unlock all reprogramming sessions with Etheria Premium.
            </Text>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="sparkles" size={18} color="#0f0321" />
              <Text style={styles.upgradeText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        ) : !sessionActive ? (
          // ---- Pre-flight: pick length, then Begin ----
          <ScrollView contentContainerStyle={styles.setupScroll}>
            <View style={styles.heroWrap}>
              {/* Radial-ish colored halo using two stacked gradients */}
              <LinearGradient
                colors={[hexToRgba(themeColor, 0.45), hexToRgba(themeColor, 0)]}
                style={styles.heroGlow}
              />
              <View
                style={[
                  styles.heroIcon,
                  {
                    backgroundColor: hexToRgba(themeColor, 0.22),
                    borderColor: hexToRgba(themeColor, 0.6),
                  },
                ]}
              >
                <Ionicons
                  name={(meta?.icon as any) || 'moon'}
                  size={44}
                  color={themeColor}
                />
              </View>
            </View>
            <Text style={styles.subtitleText}>{meta?.subtitle}</Text>

            <Text style={styles.sectionLabel}>How long tonight?</Text>
            <View style={styles.durationRow}>
              {durations.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => pickDuration(m)}
                  style={[
                    styles.durationBtn,
                    selectedDuration === m && {
                      backgroundColor: themeColor,
                      borderColor: themeColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.durationBtnText,
                      selectedDuration === m && styles.durationBtnTextActive,
                    ]}
                  >
                    {m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hintText}>
              The narration is about 10 minutes long. It will loop softly and
              fade out at {selectedDuration} minutes so you can drift into sleep.
            </Text>

            <TouchableOpacity
              style={[
                styles.beginBtn,
                { backgroundColor: themeColor },
                starting && { opacity: 0.6 },
              ]}
              onPress={startSession}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color="#0f0321" />
              ) : (
                <>
                  <Ionicons name="play" size={20} color="#0f0321" />
                  <Text style={styles.beginBtnText}>Begin Session</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.tips}>
              <View style={styles.tipRow}>
                <Ionicons name="headset-outline" size={14} color="#c4b5fd" />
                <Text style={styles.tipText}>
                  Headphones are recommended for deepest effect.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="bed-outline" size={14} color="#c4b5fd" />
                <Text style={styles.tipText}>
                  Lie down. Let your eyes close. Do not use while driving.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <Ionicons name="moon-outline" size={14} color="#c4b5fd" />
                <Text style={styles.tipText}>
                  Best played as you fall asleep.
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          // ---- Active player ----
          <View style={styles.playerContainer}>
            <View style={styles.playerHaloWrap}>
              <LinearGradient
                colors={[hexToRgba(themeColor, 0.55), hexToRgba(themeColor, 0)]}
                style={styles.playerHaloGradient}
              />
              <View
                style={[
                  styles.playerHalo,
                  {
                    backgroundColor: hexToRgba(themeColor, 0.28),
                    borderColor: hexToRgba(themeColor, 0.7),
                  },
                ]}
              >
                <Ionicons
                  name={(meta?.icon as any) || 'moon'}
                  size={64}
                  color={themeColor}
                />
              </View>
            </View>

            <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
            <Text style={styles.timerSub}>
              Session ends in about {selectedDuration} minutes
            </Text>

            {/* Progress bar (visual only) — elapsed vs planned duration */}
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: themeColor,
                      width: `${Math.min(
                        100,
                        (elapsedSeconds / Math.max(1, selectedDuration * 60)) * 100,
                      )}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabelText}>
                  {formatTime(elapsedSeconds)}
                </Text>
                <Text style={styles.progressLabelText}>
                  −{formatTime(
                    Math.max(0, selectedDuration * 60 - elapsedSeconds),
                  )}
                </Text>
              </View>
            </View>

            {/* Transport controls: -15s | play/pause | +15s */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                onPress={() => skip(-SKIP_SECONDS)}
                style={styles.skipBtn}
                accessibilityLabel="Rewind 15 seconds"
              >
                <Ionicons name="play-back" size={26} color="#e9d5ff" />
                <Text style={styles.skipLabel}>15s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlay}
                style={[styles.playBtn, { backgroundColor: themeColor }]}
                accessibilityLabel={playing ? 'Pause' : 'Play'}
              >
                <Ionicons
                  name={playing ? 'pause' : 'play'}
                  size={40}
                  color="#0f0321"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => skip(SKIP_SECONDS)}
                style={styles.skipBtn}
                accessibilityLabel="Skip 15 seconds"
              >
                <Ionicons name="play-forward" size={26} color="#e9d5ff" />
                <Text style={styles.skipLabel}>15s</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>
              {playing
                ? '✨ Close your eyes and let the words wash over you.'
                : 'Paused'}
            </Text>

            <TouchableOpacity style={styles.endBtn} onPress={endSession}>
              <Ionicons name="stop" size={16} color="#e9d5ff" />
              <Text style={styles.endBtnText}>End Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </CosmicBackdrop>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(45,27,78,0.7)',
  },
  headerTitle: {
    color: '#e9d5ff',
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', marginTop: 12, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },

  lockedTitle: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
  },
  lockedBody: {
    color: '#c4b5fd',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#fbbf24',
  },
  upgradeText: {
    color: '#0f0321',
    fontWeight: '800',
    fontSize: 15,
  },

  // ---- Setup screen ----
  setupScroll: {
    padding: 20,
    alignItems: 'center',
  },
  heroWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.9,
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  subtitleText: {
    color: '#c4b5fd',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionLabel: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 32,
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  durationBtn: {
    minWidth: 60,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(45,27,78,0.6)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.3)',
  },
  durationBtnText: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '600',
  },
  durationBtnTextActive: {
    color: '#0f0321',
    fontWeight: '800',
  },
  hintText: {
    color: '#9f7aea',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  beginBtn: {
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  beginBtnText: {
    color: '#0f0321',
    fontWeight: '800',
    fontSize: 16,
  },
  tips: {
    marginTop: 30,
    gap: 8,
    paddingHorizontal: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    color: '#c4b5fd',
    fontSize: 12,
    flex: 1,
  },

  // ---- Player screen ----
  playerContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
  },
  playerHaloWrap: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  playerHaloGradient: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  playerHalo: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  timer: {
    color: '#e9d5ff',
    fontSize: 38,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 2,
  },
  timerSub: {
    color: '#9f7aea',
    fontSize: 12,
    marginTop: 4,
  },
  progressWrap: {
    width: '100%',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(45,27,78,0.7)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLabelText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    gap: 22,
  },
  skipBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.4)',
    backgroundColor: 'rgba(45,27,78,0.55)',
  },
  skipLabel: {
    color: '#c4b5fd',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  playBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: '#9f7aea',
    fontSize: 13,
    marginTop: 22,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  endBtn: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.4)',
  },
  endBtnText: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '600',
  },
});
