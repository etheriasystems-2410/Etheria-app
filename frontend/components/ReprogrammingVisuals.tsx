/**
 * ReprogrammingVisuals — the full-screen mystical visual layer that plays
 * behind the Reprogramming (self-hypnosis) voice track. It composes three
 * elements:
 *
 *   1. MandalaBackground     — animated rotating mandala + radial pulses
 *   2. SubliminalTextFlash   — brief affirmation flashes (40-120 ms) below
 *                              conscious perception but detectable by the
 *                              subconscious.
 *   3. Optional video loop   — future: Pexels-fetched footage matched to the
 *                              script theme. Wired up but currently hidden
 *                              behind a `videoUri` prop.
 *
 * A **one-time photosensitive / subliminal disclaimer** must be acknowledged
 * before the visuals play. Acknowledgement is persisted in AsyncStorage.
 *
 * The parent Reprogramming screen owns the audio; this component only
 * animates. It responds to `active` and `paused` props so visuals pause /
 * resume with the voice track for perfect sync.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const STORAGE_KEY_ACK = 'reprogramming_visuals_ack';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Theme keyed by common Reprogramming script categories.
export type ReprogrammingTheme =
  | 'confidence'
  | 'sleep'
  | 'anxiety'
  | 'abundance'
  | 'love'
  | 'focus'
  | 'health'
  | 'default';

interface Theme {
  bg: [string, string, string];
  ringColor: string;
  glowColor: string;
  subliminals: string[];
}

const THEMES: Record<ReprogrammingTheme, Theme> = {
  confidence: {
    bg: ['#3a1c00', '#7a4400', '#1a0033'],
    ringColor: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.55)',
    subliminals: [
      'I am worthy',
      'I am powerful',
      'I trust myself',
      'I radiate confidence',
      'My voice matters',
      'I lead my life',
    ],
  },
  sleep: {
    bg: ['#050014', '#12002a', '#000005'],
    ringColor: '#7c3aed',
    glowColor: 'rgba(124,58,237,0.5)',
    subliminals: [
      'I sleep deeply',
      'My body rests',
      'I release the day',
      'I am safe now',
      'My mind is calm',
      'I drift softly',
    ],
  },
  anxiety: {
    bg: ['#0a1a2e', '#1e3a8a', '#0f0321'],
    ringColor: '#38bdf8',
    glowColor: 'rgba(56,189,248,0.5)',
    subliminals: [
      'I am safe',
      'I breathe freely',
      'I release fear',
      'I am grounded',
      'I choose peace',
      'This too shall pass',
    ],
  },
  abundance: {
    bg: ['#052e16', '#065f46', '#022c22'],
    ringColor: '#34d399',
    glowColor: 'rgba(52,211,153,0.5)',
    subliminals: [
      'I am abundant',
      'Wealth flows to me',
      'I attract prosperity',
      'I deserve success',
      'My worth is infinite',
      'Opportunities find me',
    ],
  },
  love: {
    bg: ['#2e0a1a', '#831843', '#1a0011'],
    ringColor: '#f472b6',
    glowColor: 'rgba(244,114,182,0.55)',
    subliminals: [
      'I am loved',
      'I am love',
      'Love flows through me',
      'My heart is open',
      'I attract kindred souls',
      'I forgive freely',
    ],
  },
  focus: {
    bg: ['#0f172a', '#334155', '#020617'],
    ringColor: '#38bdf8',
    glowColor: 'rgba(56,189,248,0.5)',
    subliminals: [
      'My mind is clear',
      'I focus with ease',
      'I complete my work',
      'My thoughts are sharp',
      'I am present',
      'Distraction fades',
    ],
  },
  health: {
    bg: ['#052e16', '#4d7c0f', '#0f0321'],
    ringColor: '#a3e635',
    glowColor: 'rgba(163,230,53,0.5)',
    subliminals: [
      'My body heals',
      'I am strong',
      'Vitality flows through me',
      'I honour my body',
      'Every cell is renewed',
      'I am well',
    ],
  },
  default: {
    bg: ['#12002a', '#1a0033', '#050014'],
    ringColor: '#a855f7',
    glowColor: 'rgba(168,85,247,0.5)',
    subliminals: [
      'I am becoming',
      'I am open',
      'I release the old',
      'I embrace the new',
      'I trust the journey',
      'All is well',
    ],
  },
};

interface Props {
  active: boolean; // parent session is playing (audio not paused, session running)
  paused?: boolean;
  theme?: ReprogrammingTheme;
  /** Optional additional custom affirmations to intersperse. */
  extraSubliminals?: string[];
  /** Optional royalty-free video URL that loops behind the mandala. */
  videoUri?: string | null;
  /**
   * BPM of the current session bed. When provided, the mandala glow-pulse
   * and subliminal flash cadence lock to the audio's tempo so the whole
   * visual layer breathes with the music.
   */
  audioBpm?: number | null;
}

export default function ReprogrammingVisuals({
  active,
  paused = false,
  theme = 'default',
  extraSubliminals,
  videoUri = null,
  audioBpm = null,
}: Props) {
  const th = THEMES[theme] || THEMES.default;
  const [acked, setAcked] = useState<boolean | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [fetchedVideoUri, setFetchedVideoUri] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<string | null>(null);

  // Load ack state.
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY_ACK);
        setAcked(v === '1');
      } catch {
        setAcked(false);
      }
    })();
  }, []);

  // Fetch a themed Pexels video whenever theme changes and visuals are
  // acknowledged. New random pick every session, cached server-side.
  useEffect(() => {
    if (videoUri || !BACKEND_URL || acked !== true) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `${BACKEND_URL}/api/reprogramming/theme-video/${theme}`,
        );
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        if (data?.video_url) {
          setFetchedVideoUri(data.video_url);
          setAttribution(data.attribution || null);
        }
      } catch {
        /* silent — mandala + subliminals still render */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [theme, videoUri, acked]);

  // Show disclaimer the first time the session becomes active.
  useEffect(() => {
    if (active && acked === false) {
      setShowDisclaimer(true);
    }
  }, [active, acked]);

  const handleAck = async (agree: boolean) => {
    setShowDisclaimer(false);
    if (agree) {
      await AsyncStorage.setItem(STORAGE_KEY_ACK, '1');
      setAcked(true);
    }
  };

  // Compose the subliminal list.
  const subliminals = useMemo(() => {
    const list = [...(th.subliminals || []), ...(extraSubliminals || [])];
    return list.length > 0 ? list : th.subliminals;
  }, [th.subliminals, extraSubliminals]);

  // Only render visuals when both active AND acked (user gave permission).
  const shouldRender = active && !paused && acked === true;

  return (
    <>
      {shouldRender ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {/* Backdrop gradient */}
          <LinearGradient colors={th.bg} style={StyleSheet.absoluteFill} />

          {/* Themed royalty-free video loop (Pexels) */}
          {(videoUri || fetchedVideoUri) ? (
            <VideoLoop uri={(videoUri || fetchedVideoUri) as string} />
          ) : null}

          {/* Semi-transparent tint over the video so mandala stays visible */}
          {(videoUri || fetchedVideoUri) ? (
            <View style={styles.videoTint} />
          ) : null}

          {/* Mandala */}
          <MandalaBackground
            ringColor={th.ringColor}
            glowColor={th.glowColor}
            audioBpm={audioBpm}
          />

          {/* Subliminal text flashes */}
          <SubliminalTextFlash
            words={subliminals}
            accent={th.ringColor}
            audioBpm={audioBpm}
          />

          {/* Attribution — bottom-right, tiny */}
          {attribution ? (
            <Text style={styles.attribution}>{attribution}</Text>
          ) : null}
        </View>
      ) : null}

      {/* First-use General Disclaimer */}
      <Modal
        transparent
        visible={showDisclaimer}
        animationType="fade"
        onRequestClose={() => handleAck(false)}
      >
        <View style={styles.dBackdrop}>
          <View style={styles.dCard}>
            <Ionicons name="shield-checkmark" size={38} color="#fbbf24" />
            <Text style={styles.dTitle}>General Disclaimer</Text>
            <Text style={styles.dSubtitle}>
              Subliminal Visuals · Light Therapy · Wellness Content
            </Text>

            <ScrollView
              style={styles.dScroll}
              contentContainerStyle={styles.dScrollContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.dSectionTitle}>Subliminal Visuals</Text>
              <Text style={styles.dBody}>
                This session pairs the audio with a mystical animated
                background and briefly-flashed affirmations (below conscious
                perception) that align with the reprogramming script you
                selected.
              </Text>
              <Text style={styles.dBullets}>
                {'• Flashing content — pause immediately if you feel dizzy or unwell.\n'}
                {'• Do not use if you have a history of photosensitive seizures.\n'}
                {'• Best experienced with headphones in a dim, quiet space.\n'}
                {'• You can disable visuals any time in Settings.'}
              </Text>

              <Text style={styles.dSectionTitle}>Light Therapy</Text>
              <Text style={styles.dBody}>
                Some sessions may activate your device flash or screen light at
                pulsed frequencies (beat-sync, random, or fixed Hz) to enhance
                the entrainment experience.
              </Text>
              <Text style={styles.dBullets}>
                {'• Do not use if you have epilepsy or any seizure disorder.\n'}
                {'• Discontinue immediately if you feel dizzy, disoriented, or nauseated.\n'}
                {'• Consult a physician if you are unsure whether this is safe for you.\n'}
                {'• Place the phone face-down or at a distance to protect your eyes.'}
              </Text>

              <Text style={styles.dSectionTitle}>User Agreement</Text>
              <Text style={styles.dBody}>
                Etheria is a spiritual, meditative, and self-development
                platform. By continuing, you acknowledge and agree that:
              </Text>
              <Text style={styles.dBullets}>
                {'• The content is provided for personal, entertainment, and self-reflection purposes only.\n'}
                {'• It is NOT intended to diagnose, treat, cure, or prevent any medical, psychological, or psychiatric condition.\n'}
                {'• It is NOT a substitute for professional medical, mental-health, or therapeutic advice.\n'}
                {'• You will consult a licensed professional for any health concern and will not rely on this app for medical decisions.\n'}
                {'• You use all sessions (audio, visuals, light, and hypnosis) voluntarily and at your own risk.\n'}
                {'• You are 18+ or have parental/guardian consent, and you are not operating a vehicle or heavy machinery during a session.'}
              </Text>
            </ScrollView>

            <View style={styles.dActions}>
              <TouchableOpacity onPress={() => handleAck(false)} style={styles.dCancel}>
                <Text style={styles.dCancelText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleAck(true)} style={styles.dAgree}>
                <Text style={styles.dAgreeText}>I agree · Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Mandala — a rotating layered SVG with a slow-pulsing radial glow.
// If an audio BPM is provided the glow-pulse locks onto the beat so the
// whole visual layer breathes with the assigned track.
// ───────────────────────────────────────────────────────────────────────
function MandalaBackground({
  ringColor,
  glowColor,
  audioBpm,
}: {
  ringColor: string;
  glowColor: string;
  audioBpm?: number | null;
}) {
  const rot = useSharedValue(0);
  const rotRev = useSharedValue(0);
  const pulse = useSharedValue(0);

  // Beat-locked pulse period. Fall back to 6 s when no BPM.
  // Every 2 beats = one breath cycle (feels natural at 100–140 BPM).
  const pulsePeriodMs =
    audioBpm && audioBpm > 0 ? (60_000 / audioBpm) * 2 : 6_000;

  useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: 60_000, easing: Easing.linear }),
      -1,
      false,
    );
    rotRev.value = withRepeat(
      withTiming(-360, { duration: 90_000, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, {
        duration: pulsePeriodMs,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(rot);
      cancelAnimation(rotRev);
      cancelAnimation(pulse);
    };
  }, [rot, rotRev, pulse, pulsePeriodMs]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotRev.value}deg` }],
  }));
  const glowProps = useAnimatedProps(() => ({
    r: 120 + interpolate(pulse.value, [0, 1], [0, 30]),
    opacity: 0.35 + interpolate(pulse.value, [0, 1], [0, 0.3]),
  }));

  const petalCount = 12;
  const petals = Array.from({ length: petalCount }).map((_, i) => (
    <Path
      key={i}
      d="M0,-90 C25,-60 25,-30 0,0 C-25,-30 -25,-60 0,-90 Z"
      transform={`rotate(${(360 / petalCount) * i})`}
      stroke={ringColor}
      strokeWidth={1.2}
      fill="none"
      opacity={0.6}
    />
  ));

  const innerPetals = Array.from({ length: 6 }).map((_, i) => (
    <Path
      key={i}
      d="M0,-55 C15,-35 15,-15 0,0 C-15,-15 -15,-35 0,-55 Z"
      transform={`rotate(${(360 / 6) * i})`}
      stroke={ringColor}
      strokeWidth={1}
      fill="none"
      opacity={0.75}
    />
  ));

  return (
    <View style={styles.mandalaWrap} pointerEvents="none">
      <Svg width={280} height={280} viewBox="-140 -140 280 280">
        <Defs>
          <RadialGradient id="glow" cx="0" cy="0" rx="130" ry="130">
            <Stop offset="0" stopColor={glowColor} stopOpacity="0.6" />
            <Stop offset="1" stopColor={glowColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <AnimatedCircle cx={0} cy={0} animatedProps={glowProps} fill="url(#glow)" />
      </Svg>

      <Animated.View style={[styles.mandalaLayer, outerStyle]}>
        <Svg width={280} height={280} viewBox="-140 -140 280 280">
          <G>{petals}</G>
          <Circle cx={0} cy={0} r={95} stroke={ringColor} strokeWidth={1.4} fill="none" opacity={0.7} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.mandalaLayer, innerStyle]}>
        <Svg width={280} height={280} viewBox="-140 -140 280 280">
          <G>{innerPetals}</G>
          <Circle cx={0} cy={0} r={58} stroke={ringColor} strokeWidth={1} fill="none" opacity={0.8} />
          <Circle cx={0} cy={0} r={12} stroke={ringColor} strokeWidth={1.5} fill={glowColor} opacity={0.9} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Subliminal text flasher — shows a random affirmation for ~90 ms every
// 3-5 s (or every 8 beats if we know the audio BPM, so the flash pattern
// flows with the music).
// ───────────────────────────────────────────────────────────────────────
function SubliminalTextFlash({
  words,
  accent,
  audioBpm,
}: {
  words: string[];
  accent: string;
  audioBpm?: number | null;
}) {
  const [text, setText] = useState('');
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!words || words.length === 0) return;
    let mounted = true;
    let idx = 0;
    // If we know the BPM, flash once every 8 beats (feels natural at
    // 110-140 BPM — roughly 3.4-4.4 s). Otherwise fall back to random.
    const beatMs = audioBpm && audioBpm > 0 ? 60_000 / audioBpm : null;
    const flashOnce = () => {
      if (!mounted) return;
      idx = (idx + Math.floor(Math.random() * words.length + 1)) % words.length;
      setText(words[idx]);
      opacity.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }, () => {
        opacity.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) });
      });
    };
    const schedule = () => {
      // Beat-locked: 8 beats between flashes (± tiny jitter).
      // No BPM: random 3.5–5 s window.
      const wait = beatMs
        ? beatMs * 8 + (Math.random() * 200 - 100)
        : 3500 + Math.random() * 1500;
      const t = setTimeout(() => {
        flashOnce();
        if (mounted) schedule();
      }, wait);
      return t;
    };
    const first = setTimeout(flashOnce, 2000);
    const tid = schedule();
    return () => {
      mounted = false;
      clearTimeout(first);
      clearTimeout(tid);
      cancelAnimation(opacity);
    };
  }, [words, opacity, audioBpm]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.subWrap} pointerEvents="none">
      <Animated.Text style={[styles.subText, { color: accent }, animStyle]}>
        {text}
      </Animated.Text>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────
// VideoLoop — plays a muted, looping royalty-free video underneath the
// mandala. Wired up but only used when a URL is provided.
// ───────────────────────────────────────────────────────────────────────
function VideoLoop({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill as any}
      contentFit="cover"
      allowsFullscreen={false}
      nativeControls={false}
    />
  );
}

const styles = StyleSheet.create({
  mandalaWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,3,33,0.45)',
  },
  attribution: {
    position: 'absolute',
    bottom: 6,
    right: 10,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  mandalaLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subText: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
    fontStyle: 'italic',
  },
  // Disclaimer
  dBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '86%',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    alignItems: 'center',
  },
  dTitle: {
    marginTop: 10,
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dSubtitle: {
    marginTop: 4,
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  dScroll: {
    alignSelf: 'stretch',
    marginTop: 12,
    maxHeight: 420,
  },
  dScrollContent: {
    paddingRight: 4,
    paddingBottom: 4,
  },
  dSectionTitle: {
    marginTop: 12,
    marginBottom: 4,
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    alignSelf: 'stretch',
  },
  dBody: {
    marginTop: 4,
    color: '#e9d5ff',
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
  dBullets: {
    marginTop: 6,
    color: '#c4b5fd',
    fontSize: 12,
    lineHeight: 18,
    alignSelf: 'stretch',
  },
  dActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  dCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.45)',
    alignItems: 'center',
  },
  dCancelText: { color: '#e9d5ff', fontSize: 13, fontWeight: '800' },
  dAgree: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
  },
  dAgreeText: { color: '#0f0321', fontSize: 13, fontWeight: '900' },
});
