/**
 * Reprogramming session player.
 *
 * Flow
 * ----
 * 1. Fetch session metadata + duration options.
 * 2. User picks a length (10 / 20 / 30 / 45 / 60 min).
 * 3. Fetch the pre-cached MP3 narration (base64) — server-side is cached so
 *    subsequent taps of the same session are near-instant.
 * 4. Play with loop = true. A sleep-timer starts a gentle fade-out at the
 *    chosen length, then stops playback.
 *
 * The frontend only ever handles ONE base narration per topic; longer
 * durations are achieved by looping the narration + timing the stop. This
 * keeps ElevenLabs cost bounded and gives users a hypnotic pattern of
 * repetition (which is exactly how classical self-hypnosis is dosed).
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CosmicBackdrop } from '../../components/ui';
import { AudioPlayerManager } from '../../utils/audioPlayer';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Duration presets shown to the user (must match server DURATION_PRESETS).
const DEFAULT_DURATIONS = [10, 20, 30, 45, 60];
const PLAY_VOLUME = 0.9;

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

  // ---------------- Load session metadata ----------------
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
        // Reasonable default: 20 min
        setSelectedDuration(20);
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
    // Start fade 30s before the end for a graceful exit
    const fadeLeadMs = 30_000;
    const fadeStartAt = Math.max(totalMs - fadeLeadMs, 5000);

    fadeTimerRef.current = setTimeout(async () => {
      // Gentle 30s linear fade
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

    // Tick counter for the header
    tickIntervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
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
            <View
              style={[
                styles.heroIcon,
                { backgroundColor: (meta?.color || '#7c3aed') + '22' },
              ]}
            >
              <Ionicons
                name={(meta?.icon as any) || 'moon'}
                size={44}
                color={meta?.color || '#a855f7'}
              />
            </View>
            <Text style={styles.subtitleText}>{meta?.subtitle}</Text>

            <Text style={styles.sectionLabel}>How long tonight?</Text>
            <View style={styles.durationRow}>
              {durations.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setSelectedDuration(m)}
                  style={[
                    styles.durationBtn,
                    selectedDuration === m && styles.durationBtnActive,
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
              style={[styles.beginBtn, starting && { opacity: 0.6 }]}
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
            <View
              style={[
                styles.playerHalo,
                { backgroundColor: (meta?.color || '#7c3aed') + '30' },
              ]}
            >
              <Ionicons
                name={(meta?.icon as any) || 'moon'}
                size={64}
                color={meta?.color || '#a855f7'}
              />
            </View>

            <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
            <Text style={styles.timerSub}>
              Session ends in about {selectedDuration} minutes
            </Text>

            <View style={styles.controls}>
              <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                <Ionicons
                  name={playing ? 'pause' : 'play'}
                  size={40}
                  color="#0f0321"
                />
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
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  subtitleText: {
    color: '#c4b5fd',
    fontSize: 14,
    marginTop: 12,
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
  durationBtnActive: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
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
    backgroundColor: '#fbbf24',
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
  playerHalo: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  timer: {
    color: '#e9d5ff',
    fontSize: 38,
    fontWeight: '700',
    marginTop: 24,
    letterSpacing: 2,
  },
  timerSub: {
    color: '#9f7aea',
    fontSize: 12,
    marginTop: 4,
  },
  controls: {
    marginTop: 32,
  },
  playBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fbbf24',
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
