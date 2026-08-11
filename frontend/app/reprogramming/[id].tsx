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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import LightTherapyController from '../../components/LightTherapyController';
import ReprogrammingVisuals, {
  type ReprogrammingTheme,
} from '../../components/ReprogrammingVisuals';
import SessionDrawer, {
  SessionDrawerSection,
} from '../../components/SessionDrawer';
import { useBottomSafePad } from '../../hooks/useBottomSafePad';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const DEFAULT_DURATIONS = [10, 20, 30, 45, 60];
const PLAY_VOLUME = 0.9;
const SKIP_SECONDS = 15;
const STORAGE_KEY = (id: string) => `reprogramming:duration:${id}`;
const STORAGE_KEY_VOICE_VOL = 'reprogramming:voice_volume';
const STORAGE_KEY_BED_VOL = 'reprogramming:bed_volume';

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

/** Rough keyword-based mapping from script metadata → visual theme. */
function inferVisualTheme(meta?: SessionMeta | null): ReprogrammingTheme {
  if (!meta) return 'default';
  const hay = `${meta.title} ${meta.subtitle} ${meta.id}`.toLowerCase();
  if (/(sleep|insomnia|rest|dream|deep\s*sleep)/.test(hay)) return 'sleep';
  if (/(confidence|self[-\s]*worth|assert|power|leader)/.test(hay)) return 'confidence';
  if (/(anxiety|calm|stress|panic|worry|fear)/.test(hay)) return 'anxiety';
  if (/(abundance|wealth|prosperity|money|success)/.test(hay)) return 'abundance';
  if (/(love|relationship|heart|romance|self[-\s]*love)/.test(hay)) return 'love';
  if (/(focus|productivity|study|concentration|attention)/.test(hay)) return 'focus';
  if (/(health|healing|body|energy|vital)/.test(hay)) return 'health';
  return 'default';
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
  const bottomPad = useBottomSafePad();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [selectedDuration, setSelectedDuration] = useState<number>(20);

  // Volume presets — persisted per user across sessions.
  const [voiceVolume, setVoiceVolumeState] = useState<number>(PLAY_VOLUME);
  const [bedVolume, setBedVolumeState] = useState<number>(0.30);

  const [starting, setStarting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);

  const playerRef = useRef<AudioPlayerManager | null>(null);
  // Dedicated hypnotic session-audio player — randomly assigned per
  // session, loops under the voice, fades out with the script.
  const sessionAudioRef = useRef<AudioPlayerManager | null>(null);
  const [sessionAudioBpm, setSessionAudioBpm] = useState<number | null>(null);
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

  // ---------------- Load persisted volumes ----------------
  useEffect(() => {
    (async () => {
      try {
        const [vv, bv] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_VOICE_VOL),
          AsyncStorage.getItem(STORAGE_KEY_BED_VOL),
        ]);
        if (vv) {
          const n = Number(vv);
          if (Number.isFinite(n) && n >= 0 && n <= 1) setVoiceVolumeState(n);
        }
        if (bv) {
          const n = Number(bv);
          if (Number.isFinite(n) && n >= 0 && n <= 1) setBedVolumeState(n);
        }
      } catch {}
    })();
  }, []);

  const setVoiceVolume = useCallback(async (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVoiceVolumeState(clamped);
    AsyncStorage.setItem(STORAGE_KEY_VOICE_VOL, String(clamped)).catch(() => {});
    try {
      await playerRef.current?.setVolume(clamped);
    } catch {}
  }, []);

  const setBedVolume = useCallback(async (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setBedVolumeState(clamped);
    AsyncStorage.setItem(STORAGE_KEY_BED_VOL, String(clamped)).catch(() => {});
    try {
      await sessionAudioRef.current?.setVolume(clamped);
    } catch {}
  }, []);

  // ---------------- Cleanup on unmount ----------------
  useEffect(() => {
    return () => {
      try {
        playerRef.current?.unload();
      } catch {}
      try {
        sessionAudioRef.current?.unload();
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

  const scheduleFadeOut = (durationMinutes: number, elapsedOffset: number = 0) => {
    clearTimers();
    const totalMs = durationMinutes * 60 * 1000;
    const remainingMs = Math.max(0, totalMs - elapsedOffset * 1000);
    const fadeLeadMs = 30_000;
    // Kick fade in 30s before the session ends. If we're already inside the
    // fade window (or past it), start immediately.
    const fadeStartAt = Math.max(remainingMs - fadeLeadMs, 200);

    fadeTimerRef.current = setTimeout(async () => {
      try {
        const steps = 30;
        // Snapshot current session-audio volume (user-configurable via drawer)
        const sessionAudioStartVol = bedVolume;
        for (let i = steps; i >= 0; i -= 1) {
          const fraction = i / steps;
          const v = voiceVolume * fraction;
          const sv = sessionAudioStartVol * fraction;
          await playerRef.current?.setVolume(Math.max(0, v));
          await sessionAudioRef.current?.setVolume(Math.max(0, sv));
          await new Promise((r) => setTimeout(r, 1000));
        }
        await playerRef.current?.unload();
        await sessionAudioRef.current?.unload();
        sessionAudioRef.current = null;
      } catch {}
      setPlaying(false);
      setSessionActive(false);
      setSessionAudioBpm(null);
    }, fadeStartAt);

    tickIntervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  /**
   * Scrub the SESSION timeline (not the audio) to `newElapsedSeconds`.
   * The audio keeps looping — this only affects the sleep-timer / fade-out.
   * Loop-safe because the audio position is untouched.
   */
  const scrubSessionTo = (newElapsedSeconds: number) => {
    if (!sessionActive) return;
    const totalSeconds = selectedDuration * 60;
    const clamped = Math.max(0, Math.min(totalSeconds, Math.round(newElapsedSeconds)));
    setElapsedSeconds(clamped);
    // Reschedule the fade-out timer based on the new position
    scheduleFadeOut(selectedDuration, clamped);
    // If we scrubbed all the way to the end, stop immediately.
    if (clamped >= totalSeconds) {
      (async () => {
        try {
          await playerRef.current?.unload();
        } catch {}
        try {
          await sessionAudioRef.current?.unload();
        } catch {}
        sessionAudioRef.current = null;
        setPlaying(false);
        setSessionActive(false);
        setSessionAudioBpm(null);
      })();
    }
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
        `${BACKEND_URL}/api/reprogramming/audio-base64/${meta.id}?duration=${selectedDuration}`,
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
      // Voice is duration-tailored server-side — do NOT loop the vocals.
      await player.loadAndPlay(uri, { loop: false, volume: voiceVolume });
      playerRef.current = player;

      // Fetch + start the hypnotic session-audio bed (random of 5 tracks).
      // Plays looped underneath the voice at the persisted bed volume so
      // voice stays dominant.
      try {
        const sr = await fetch(`${BACKEND_URL}/api/reprogramming/session-audio`);
        if (sr.ok) {
          const sdata = await sr.json();
          if (sdata?.url) {
            const sPlayer = new AudioPlayerManager();
            await sPlayer.loadAndPlay(sdata.url, {
              loop: true,
              volume: bedVolume,
            });
            sessionAudioRef.current = sPlayer;
            setSessionAudioBpm(
              typeof sdata.bpm === 'number' ? sdata.bpm : null,
            );
          }
        }
      } catch {
        /* silent — voice still plays without the bed */
      }

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
        await sessionAudioRef.current?.pause();
        setPlaying(false);
      } else {
        await playerRef.current.play();
        await sessionAudioRef.current?.play();
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
    try {
      await sessionAudioRef.current?.unload();
    } catch {}
    sessionAudioRef.current = null;
    setSessionAudioBpm(null);
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
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            accessibilityLabel="Session options"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="menu" size={26} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {meta?.title || 'Session'}
          </Text>
          <TouchableOpacity
            onPress={endSession}
            accessibilityLabel="Close"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color="#e9d5ff" />
          </TouchableOpacity>
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
          <ScrollView contentContainerStyle={[styles.setupScroll, { paddingBottom: bottomPad }]}>
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
            {/* Mystical animated visual layer + subliminal affirmations */}
            <ReprogrammingVisuals
              active={sessionActive}
              paused={!playing}
              theme={inferVisualTheme(meta)}
              audioBpm={sessionAudioBpm}
            />

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

            {/* Progress bar — tap anywhere to scrub the session timeline.
                The audio itself continues to loop, so scrubbing is loop-safe. */}
            <View
              style={styles.progressWrap}
              onLayout={(e) => setProgressWidth(e.nativeEvent.layout.width - 8)}
            >
              <Pressable
                onPress={(e) => {
                  const w = progressWidth;
                  if (w <= 0) return;
                  const x = Math.max(
                    0,
                    Math.min(w, e.nativeEvent.locationX),
                  );
                  const totalSecs = selectedDuration * 60;
                  scrubSessionTo((x / w) * totalSecs);
                }}
                accessibilityLabel="Seek session"
                style={styles.progressTouchTarget}
              >
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
                  {/* Small handle at the current position for affordance */}
                  <View
                    style={[
                      styles.progressHandle,
                      {
                        backgroundColor: themeColor,
                        borderColor: '#0f0321',
                        left: `${Math.min(
                          100,
                          (elapsedSeconds / Math.max(1, selectedDuration * 60)) * 100,
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </Pressable>
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

            <View style={styles.optionsHintRow}>
              <Ionicons name="menu" size={13} color="#c4b5fd" />
              <Text style={styles.optionsHintText}>
                Tap the menu for Light Therapy, Session Length, and Audio
              </Text>
            </View>

            <TouchableOpacity style={styles.endBtn} onPress={endSession}>
              <Ionicons name="stop" size={16} color="#e9d5ff" />
              <Text style={styles.endBtnText}>End Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      {/* Left slide-out drawer with all ancillary controls. Keeps the main
          player uncluttered so the visual layer + timer stay dominant. */}
      <SessionDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        accentColor={themeColor}
        title={meta ? `${meta.title} · Options` : 'Session Options'}
      >
        <SessionDrawerSection
          title="Session Length"
          icon="time"
          accentColor={themeColor}
        >
          <View style={styles.drawerDurationRow}>
            {durations.map((m) => {
              const active = selectedDuration === m;
              const disabled = sessionActive; // cannot change mid-session
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => pickDuration(m)}
                  disabled={disabled}
                  style={[
                    styles.drawerDurationBtn,
                    active && {
                      backgroundColor: themeColor,
                      borderColor: themeColor,
                    },
                    disabled && !active && { opacity: 0.4 },
                  ]}
                >
                  <Text
                    style={[
                      styles.drawerDurationBtnText,
                      active && styles.durationBtnTextActive,
                    ]}
                  >
                    {m}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {sessionActive ? (
            <Text style={styles.drawerHelperText}>
              Length is locked once the session begins.
            </Text>
          ) : null}
        </SessionDrawerSection>

        <SessionDrawerSection title="Audio" icon="volume-high" accentColor={themeColor}>
          <VolumeSelector
            label="Voice"
            value={voiceVolume}
            onChange={setVoiceVolume}
            accent={themeColor}
            presets={[
              { label: 'Soft', value: 0.55 },
              { label: 'Normal', value: 0.9 },
              { label: 'Loud', value: 1.0 },
            ]}
          />
          <VolumeSelector
            label="Music Bed"
            value={bedVolume}
            onChange={setBedVolume}
            accent={themeColor}
            presets={[
              { label: 'Off', value: 0.0 },
              { label: 'Soft', value: 0.15 },
              { label: 'Normal', value: 0.3 },
              { label: 'Full', value: 0.5 },
            ]}
          />
        </SessionDrawerSection>

        <SessionDrawerSection title="Light Therapy" icon="bulb" accentColor={themeColor}>
          <LightTherapyController
            active={sessionActive}
            paused={!playing}
            accentColor={themeColor}
            autoFrequencyHz={6}
            musicBpm={sessionAudioBpm}
          />
        </SessionDrawerSection>
      </SessionDrawer>
    </CosmicBackdrop>
  );
}

/**
 * Compact volume picker — 3-4 discrete presets displayed as pills. Avoids
 * needing a native slider dependency while still giving users a meaningful
 * amount of control. The active preset is the one whose value is closest
 * to the current volume.
 */
function VolumeSelector({
  label,
  value,
  onChange,
  presets,
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  presets: { label: string; value: number }[];
  accent: string;
}) {
  const activeIdx = presets.reduce(
    (best, p, i) =>
      Math.abs(p.value - value) <
      Math.abs(presets[best].value - value)
        ? i
        : best,
    0,
  );
  return (
    <View style={styles.volumeWrap}>
      <Text style={styles.volumeLabel}>{label}</Text>
      <View style={styles.volumeRow}>
        {presets.map((p, i) => {
          const active = i === activeIdx;
          return (
            <TouchableOpacity
              key={p.label}
              onPress={() => onChange(p.value)}
              style={[
                styles.volumeBtn,
                active && { backgroundColor: accent, borderColor: accent },
              ]}
            >
              <Text
                style={[
                  styles.volumeBtnText,
                  active && styles.volumeBtnTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
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
  progressTouchTarget: {
    paddingVertical: 12,   // enlarge tap area vertically for easy scrubbing
    marginVertical: -6,    // keep visual layout unchanged
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(45,27,78,0.7)',
    overflow: 'visible',
    justifyContent: 'center',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressHandle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    top: -5,
    borderWidth: 2,
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
  // Drawer-specific styles
  optionsHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    opacity: 0.8,
  },
  optionsHintText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontStyle: 'italic',
  },
  drawerDurationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  drawerDurationBtn: {
    flexGrow: 1,
    flexBasis: '18%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    backgroundColor: 'rgba(15,3,33,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerDurationBtnText: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '700',
  },
  drawerHelperText: {
    color: '#9ca3af',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
  volumeWrap: {
    marginBottom: 4,
  },
  volumeLabel: {
    color: '#e9d5ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  volumeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  volumeBtn: {
    flexGrow: 1,
    flexBasis: '22%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(15,3,33,0.55)',
    alignItems: 'center',
  },
  volumeBtnText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  volumeBtnTextActive: {
    color: '#0f0321',
  },
});
