/**
 * AmbientMusicMixer — a small horizontal picker + volume slider that plays a
 * soothing ambient loop UNDER an existing meditation tone (binaural / chakra
 * / reprogramming). The mixer manages its own AudioPlayerManager so the tone
 * player above it stays untouched.
 *
 * Props
 * -----
 * active       — parent session is playing (music should be playing too)
 * paused       — parent session is paused (music should be paused too)
 * accentColor  — colour used for the "selected" pill / slider fill
 * defaultTrackId — optional initial selection (defaults to none)
 *
 * The mixer starts with "None" selected so users must opt-in.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayerManager } from '../utils/audioPlayer';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export interface AmbientTrack {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
}

interface Props {
  active: boolean;
  paused?: boolean;
  accentColor?: string;
  defaultTrackId?: string | null;
  /** Optional callback so the parent can persist the chosen track. */
  onTrackChange?: (trackId: string | null) => void;
}

const STORAGE_KEY_TRACK = 'ambient_music_track_id';
const STORAGE_KEY_VOLUME = 'ambient_music_volume';

export default function AmbientMusicMixer({
  active,
  paused = false,
  accentColor = '#a855f7',
  defaultTrackId = null,
  onTrackChange,
}: Props) {
  const [tracks, setTracks] = useState<AmbientTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [trackId, setTrackId] = useState<string | null>(defaultTrackId);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [busy, setBusy] = useState(false);

  const playerRef = useRef<AudioPlayerManager | null>(null);
  const currentPlayingTrackRef = useRef<string | null>(null);

  // Load persisted preferences once.
  useEffect(() => {
    (async () => {
      try {
        const [t, v] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TRACK),
          AsyncStorage.getItem(STORAGE_KEY_VOLUME),
        ]);
        if (t) setTrackId(t);
        if (v) {
          const parsed = Number(v);
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            setMusicVolume(parsed);
          }
        }
      } catch {}
    })();
  }, []);

  // Fetch track list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/meditation/ambient/tracks`);
        const data = await r.json();
        if (!cancelled) setTracks(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setTracks([]);
      } finally {
        if (!cancelled) setLoadingTracks(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stop + unload the music player. Safe to call at any time.
  const stopMusic = useCallback(async () => {
    try {
      await playerRef.current?.unload();
    } catch {}
    playerRef.current = null;
    currentPlayingTrackRef.current = null;
  }, []);

  // Start music playback for the given track.
  const startMusic = useCallback(
    async (id: string) => {
      if (currentPlayingTrackRef.current === id && playerRef.current) return;
      await stopMusic();
      setBusy(true);
      try {
        const player = new AudioPlayerManager();
        await player.loadAndPlay(
          `${BACKEND_URL}/api/meditation/ambient/stream/${id}?duration=30`,
          { loop: true, volume: musicVolume },
        );
        playerRef.current = player;
        currentPlayingTrackRef.current = id;
      } catch {
        // Silent — user still hears the primary tone.
      } finally {
        setBusy(false);
      }
    },
    [musicVolume, stopMusic],
  );

  // React to lifecycle changes coming from the parent session.
  useEffect(() => {
    (async () => {
      if (!active || !trackId) {
        await stopMusic();
        return;
      }
      if (paused) {
        try {
          await playerRef.current?.pause();
        } catch {}
        return;
      }
      // Active + not paused
      if (
        playerRef.current &&
        currentPlayingTrackRef.current === trackId
      ) {
        try {
          await playerRef.current.play();
        } catch {}
      } else {
        await startMusic(trackId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused, trackId]);

  // Sync volume changes live.
  useEffect(() => {
    (async () => {
      if (playerRef.current) {
        try {
          await playerRef.current.setVolume(musicVolume);
        } catch {}
      }
    })();
    AsyncStorage.setItem(STORAGE_KEY_VOLUME, String(musicVolume)).catch(() => {});
  }, [musicVolume]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, [stopMusic]);

  const handleSelect = (id: string | null) => {
    setTrackId(id);
    onTrackChange?.(id);
    AsyncStorage.setItem(STORAGE_KEY_TRACK, id ?? '').catch(() => {});
  };

  const pillList = useMemo(
    () => [{ id: '__none__', name: 'None', icon: 'close-circle-outline' } as AmbientTrack, ...tracks],
    [tracks],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="musical-notes" size={13} color={accentColor} />
        <Text style={[styles.header, { color: accentColor }]}>AMBIENT MUSIC</Text>
        {busy ? <ActivityIndicator size="small" color={accentColor} /> : null}
      </View>

      {loadingTracks ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={styles.loadingText}>Loading tracks…</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        >
          {pillList.map((tr) => {
            const isNone = tr.id === '__none__';
            const selected = isNone ? trackId === null : trackId === tr.id;
            return (
              <TouchableOpacity
                key={tr.id}
                onPress={() => handleSelect(isNone ? null : tr.id)}
                activeOpacity={0.85}
                style={[
                  styles.pill,
                  selected && {
                    borderColor: accentColor,
                    backgroundColor: `${accentColor}22`,
                  },
                ]}
              >
                <Ionicons
                  name={(tr.icon as any) || 'musical-notes'}
                  size={13}
                  color={selected ? accentColor : '#c4b5fd'}
                />
                <Text
                  style={[
                    styles.pillText,
                    selected && { color: accentColor, fontWeight: '800' },
                  ]}
                >
                  {tr.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Music volume slider (only visible when a track is picked). */}
      {trackId ? (
        <View style={styles.volRow}>
          <Ionicons name="musical-note" size={14} color="#c4b5fd" />
          <View style={styles.volTrack}>
            <View
              style={[
                styles.volFill,
                { width: `${musicVolume * 100}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
          <View style={styles.volDots}>
            {[0.1, 0.25, 0.4, 0.55, 0.7].map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => setMusicVolume(v)}
                style={[
                  styles.volDot,
                  musicVolume >= v && { backgroundColor: `${accentColor}55` },
                ]}
              />
            ))}
          </View>
          <Text style={styles.volLabel}>{Math.round(musicVolume * 100)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15,3,33,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  header: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  loadingText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontStyle: 'italic',
  },
  pills: {
    gap: 8,
    paddingRight: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.35)',
    backgroundColor: 'rgba(30,14,58,0.65)',
  },
  pillText: {
    color: '#e9d5ff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  volTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(45,27,78,0.85)',
    overflow: 'hidden',
  },
  volFill: {
    height: '100%',
    borderRadius: 2,
  },
  volDots: {
    flexDirection: 'row',
    gap: 4,
  },
  volDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.45)',
  },
  volLabel: {
    color: '#c4b5fd',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 30,
    textAlign: 'right',
  },
});
