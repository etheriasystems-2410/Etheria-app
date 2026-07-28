/**
 * LightTherapyController — pulses the phone's flashlight at a chosen brainwave
 * frequency (Delta/Theta/Alpha/Beta/Gamma) so users can layer photic light
 * therapy on top of any Etheria meditation.
 *
 * ── Safety
 *   • A photosensitive-seizure warning is shown before the first use per
 *     device. Acknowledgement is persisted in AsyncStorage.
 *   • Automatic hard-cutoff after 20 min (adjustable) to prevent LED
 *     over-heating.
 *
 * ── Platform behaviour
 *   • Native (iOS/Android) — mounts a hidden <CameraView torch> and toggles
 *     the `enableTorch` prop on/off at the target frequency.
 *   • Web / Expo Go — falls back to a full-screen white overlay that pulses
 *     at the same frequency so the effect can still be previewed.
 *
 * ── Frequency presets (Hz = cycles per second)
 *     Delta   2 Hz (deep sleep)
 *     Theta   6 Hz (meditation)
 *     Alpha  10 Hz (relaxation)
 *     Beta   20 Hz (focus)
 *     Gamma  40 Hz (peak awareness)
 *
 * If `autoFrequencyHz` is provided (e.g. from the current binaural beat) it
 * becomes the initial pick, but users can override.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  active: boolean; // parent session is playing
  paused?: boolean; // parent session is paused
  accentColor?: string;
  /** If provided (in Hz), used as initial frequency selection. */
  autoFrequencyHz?: number;
}

interface PresetFreq {
  id: string;
  name: string;
  hz: number;
  color: string;
}

const PRESETS: PresetFreq[] = [
  { id: 'delta', name: 'Delta 2 Hz', hz: 2, color: '#3b82f6' },
  { id: 'theta', name: 'Theta 6 Hz', hz: 6, color: '#a855f7' },
  { id: 'alpha', name: 'Alpha 10 Hz', hz: 10, color: '#10b981' },
  { id: 'beta', name: 'Beta 20 Hz', hz: 20, color: '#f59e0b' },
  { id: 'gamma', name: 'Gamma 40 Hz', hz: 40, color: '#ef4444' },
];

const STORAGE_WARNING_ACK = 'light_therapy_warning_ack';
const STORAGE_FREQ = 'light_therapy_freq_hz';
const AUTO_STOP_MS = 20 * 60 * 1000; // 20 minutes

function matchPreset(hz: number | undefined | null): PresetFreq {
  if (!hz || hz <= 0) return PRESETS[2]; // default Alpha
  // pick closest preset
  return PRESETS.reduce((best, p) =>
    Math.abs(p.hz - hz) < Math.abs(best.hz - hz) ? p : best,
  );
}

export default function LightTherapyController({
  active,
  paused = false,
  accentColor = '#fbbf24',
  autoFrequencyHz,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningAcked, setWarningAcked] = useState(false);
  const [freq, setFreq] = useState<PresetFreq>(matchPreset(autoFrequencyHz));
  const [torchOn, setTorchOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const pulseTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNativeTorchSupported = Platform.OS !== 'web';

  // Load persisted preferences.
  useEffect(() => {
    (async () => {
      try {
        const [ack, savedHz] = await Promise.all([
          AsyncStorage.getItem(STORAGE_WARNING_ACK),
          AsyncStorage.getItem(STORAGE_FREQ),
        ]);
        if (ack === '1') setWarningAcked(true);
        if (savedHz) {
          const parsed = Number(savedHz);
          if (!Number.isNaN(parsed) && parsed > 0) setFreq(matchPreset(parsed));
        }
      } catch {}
    })();
  }, []);

  // Follow autoFrequencyHz if the parent's binaural beat changes.
  useEffect(() => {
    if (autoFrequencyHz && autoFrequencyHz > 0) {
      setFreq(matchPreset(autoFrequencyHz));
    }
  }, [autoFrequencyHz]);

  const stopPulsing = useCallback(() => {
    if (pulseTimer.current) {
      clearInterval(pulseTimer.current);
      pulseTimer.current = null;
    }
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
    setTorchOn(false);
  }, []);

  const startPulsing = useCallback(() => {
    stopPulsing();
    const halfPeriodMs = Math.max(6, 1000 / (freq.hz * 2)); // toggle every half cycle
    pulseTimer.current = setInterval(() => {
      setTorchOn((prev) => !prev);
    }, halfPeriodMs);
    autoStopTimer.current = setTimeout(() => {
      setEnabled(false);
      Alert.alert(
        'Light therapy paused',
        'Auto-stopped after 20 minutes to prevent device overheating. Tap Enable to continue.',
      );
    }, AUTO_STOP_MS);
  }, [freq.hz, stopPulsing]);

  // React to enable/active/paused lifecycle.
  useEffect(() => {
    if (!enabled || !active || paused) {
      stopPulsing();
      return;
    }
    startPulsing();
    return stopPulsing;
  }, [enabled, active, paused, freq.hz, startPulsing, stopPulsing]);

  const persistFreq = (p: PresetFreq) => {
    setFreq(p);
    AsyncStorage.setItem(STORAGE_FREQ, String(p.hz)).catch(() => {});
  };

  const requestEnable = async () => {
    if (!warningAcked) {
      setWarningOpen(true);
      return;
    }
    await ensurePermissionAndEnable();
  };

  const ensurePermissionAndEnable = async () => {
    if (!isNativeTorchSupported) {
      // Web / Expo Go — visual preview mode
      setEnabled(true);
      return;
    }
    if (!permission) {
      setEnabled(true);
      return;
    }
    if (permission.granted) {
      setEnabled(true);
      return;
    }
    if (!permission.canAskAgain) {
      Alert.alert(
        'Camera permission needed',
        'Please enable camera access in your device settings so Etheria can control the flashlight.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const res = await requestPermission();
    if (res?.granted) {
      setEnabled(true);
    } else if (res && res.canAskAgain === false) {
      Alert.alert(
        'Permission required',
        'Etheria needs camera access to control the flashlight. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const handleAckWarning = async () => {
    await AsyncStorage.setItem(STORAGE_WARNING_ACK, '1');
    setWarningAcked(true);
    setWarningOpen(false);
    await ensurePermissionAndEnable();
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="bulb" size={13} color={accentColor} />
        <Text style={[styles.header, { color: accentColor }]}>LIGHT THERAPY</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => (enabled ? setEnabled(false) : requestEnable())}
          style={[
            styles.togglePill,
            enabled && { backgroundColor: accentColor, borderColor: accentColor },
          ]}
          activeOpacity={0.85}
        >
          <Ionicons
            name={enabled ? 'flash' : 'flash-off'}
            size={12}
            color={enabled ? '#0f0321' : '#c4b5fd'}
          />
          <Text
            style={[
              styles.togglePillText,
              enabled && { color: '#0f0321' },
            ]}
          >
            {enabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helper}>
        {isNativeTorchSupported
          ? 'Pulses your phone flashlight to entrain brainwaves. Place phone face-down.'
          : 'Preview mode — the on-screen glow simulates the flash. Build to a real device to use the LED.'}
      </Text>

      {/* Preset row */}
      <View style={styles.presets}>
        {PRESETS.map((p) => {
          const selected = freq.id === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => persistFreq(p)}
              activeOpacity={0.85}
              style={[
                styles.presetPill,
                selected && {
                  borderColor: p.color,
                  backgroundColor: `${p.color}22`,
                },
              ]}
            >
              <View style={[styles.presetDot, { backgroundColor: p.color }]} />
              <Text
                style={[
                  styles.presetText,
                  selected && { color: p.color, fontWeight: '900' },
                ]}
              >
                {p.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Live pulse indicator */}
      {enabled && active && !paused ? (
        <View style={styles.livePillRow}>
          <View
            style={[
              styles.livePulseDot,
              { backgroundColor: torchOn ? accentColor : 'rgba(45,27,78,0.7)' },
            ]}
          />
          <Text style={styles.liveText}>
            {isNativeTorchSupported ? 'Flashing' : 'Previewing'} at {freq.hz} Hz · auto-stops in 20 min
          </Text>
        </View>
      ) : null}

      {/* Hidden CameraView drives the torch on native. */}
      {isNativeTorchSupported && enabled && active && !paused ? (
        <View pointerEvents="none" style={styles.hiddenCamWrap}>
          <CameraView
            facing="back"
            enableTorch={torchOn}
            active={true}
            style={styles.hiddenCam}
          />
        </View>
      ) : null}

      {/* Full-screen preview overlay on web / Expo Go */}
      {enabled && active && !paused && !isNativeTorchSupported ? (
        <Modal transparent animationType="none" visible={torchOn}>
          <LinearGradient
            colors={['rgba(255,255,255,0.98)', 'rgba(255,247,220,0.98)']}
            style={StyleSheet.absoluteFill}
          />
        </Modal>
      ) : null}

      {/* Photosensitive warning modal */}
      <Modal
        visible={warningOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWarningOpen(false)}
      >
        <View style={styles.warnBackdrop}>
          <View style={styles.warnCard}>
            <Ionicons name="warning" size={38} color="#f59e0b" />
            <Text style={styles.warnTitle}>Photosensitive Warning</Text>
            <Text style={styles.warnBody}>
              Flashing lights at these frequencies can trigger seizures in people with
              photosensitive epilepsy or a history of seizures.
            </Text>
            <Text style={styles.warnBullets}>
              {'• Do not use if you have epilepsy or a seizure disorder.\n'}
              {'• Discontinue immediately if you feel dizzy, disoriented, or nauseated.\n'}
              {'• Consult a physician if you are unsure.\n'}
              {'• Place the phone face-down for best results and to protect your eyes.'}
            </Text>
            <View style={styles.warnActions}>
              <TouchableOpacity
                onPress={() => setWarningOpen(false)}
                style={styles.warnCancel}
              >
                <Text style={styles.warnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAckWarning}
                style={styles.warnAgree}
              >
                <Text style={styles.warnAgreeText}>I understand · Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15,3,33,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  header: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    backgroundColor: 'rgba(30,14,58,0.65)',
  },
  togglePillText: {
    color: '#c4b5fd',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  helper: {
    color: '#9f7aea',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
    marginBottom: 8,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(159,122,234,0.35)',
    backgroundColor: 'rgba(30,14,58,0.65)',
  },
  presetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presetText: {
    color: '#e9d5ff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  livePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  liveText: {
    color: '#c4b5fd',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  hiddenCamWrap: {
    position: 'absolute',
    width: 1,
    height: 1,
    left: -100,
    top: -100,
    opacity: 0,
  },
  hiddenCam: {
    width: 1,
    height: 1,
  },
  // Warning modal
  warnBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  warnCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    alignItems: 'center',
  },
  warnTitle: {
    marginTop: 10,
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  warnBody: {
    marginTop: 10,
    color: '#e9d5ff',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  warnBullets: {
    marginTop: 12,
    color: '#c4b5fd',
    fontSize: 12,
    lineHeight: 18,
    alignSelf: 'stretch',
  },
  warnActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  warnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
    alignItems: 'center',
  },
  warnCancelText: { color: '#e9d5ff', fontSize: 13, fontWeight: '800' },
  warnAgree: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
  },
  warnAgreeText: { color: '#0f0321', fontSize: 13, fontWeight: '900' },
});
