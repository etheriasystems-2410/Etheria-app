/**
 * useSpiritGuideAudio — encapsulates all audio state, animation refs, and
 * playback logic for the Spirit Guides screen.
 *
 * Owns:
 *  - `isMuted` (persisted to AsyncStorage as `spirit_guides_muted`)
 *  - `playingAudioIndex` — which message bubble is currently emitting audio
 *  - `audioError`, `generatingAudio` — UI banners
 *  - `pulseAnim`, `glowAnim` — animated ring around chat header avatar
 *  - Audio player lifecycle (load / play / unload)
 *
 * Exposes:
 *  - `playAudio(b64, index)`           — fire-and-forget playback (used for replays / single greetings)
 *  - `playAudioAndWait(b64, idx, gap)` — promise-resolving playback (used for divine-pair chaining)
 *  - `generateAndPlayAudio(text, guideName, language, messageIndex, onAudio)`
 *      — POSTs /api/tts/generate, then plays. The onAudio callback receives the
 *        returned base64 so the parent can attach it to its message state.
 *  - `toggleMute()`                    — flips + persists mute
 *  - `isTalking`                       — derived bool (loading || generatingAudio || playing)
 *
 * The hook drives its own pulse animation effect using `isTalking` and `selectedGuide`.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayerManager } from '../utils/audioPlayer';
import { Guide } from '../constants/guides';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Params {
  /** Chat loading state from the parent — folded into `isTalking`. */
  chatLoading: boolean;
  /** Currently active guide — used to start/stop the pulsing ring effect. */
  selectedGuide: Guide | null;
}

export interface SpiritGuideAudio {
  // Mute
  isMuted: boolean;
  toggleMute: () => Promise<void>;
  // Status flags
  playingAudioIndex: number | null;
  generatingAudio: boolean;
  audioError: string | null;
  setAudioError: (e: string | null) => void;
  isTalking: boolean;
  // Animation refs
  pulseAnim: Animated.Value;
  glowAnim: Animated.Value;
  // Playback API
  playAudio: (audioBase64: string, messageIndex: number) => Promise<void>;
  playAudioAndWait: (audioBase64: string, messageIndex: number, gapMs?: number) => Promise<void>;
  generateAndPlayAudio: (
    text: string,
    guideName: string,
    language: string,
    messageIndex: number,
    onAudio?: (audioBase64: string) => void,
    voiceId?: string,
  ) => Promise<void>;
}

export function useSpiritGuideAudio({ chatLoading, selectedGuide }: Params): SpiritGuideAudio {
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const audioPlayerRef = useRef<AudioPlayerManager | null>(null);

  // Animation refs for the pulsating ring around the chat header avatar
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  const isTalking = chatLoading || generatingAudio || playingAudioIndex !== null;

  // Load persisted mute pref once on mount
  useEffect(() => {
    (async () => {
      try {
        const muted = await AsyncStorage.getItem('spirit_guides_muted');
        if (muted === 'true') setIsMuted(true);
      } catch (error) {
        console.error('Error loading mute preference:', error);
      }
    })();
  }, []);

  // Unload the player when the screen unmounts so we don't leak audio sessions
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.unload();
      }
    };
  }, []);

  // Pulse + glow when the guide is "talking" (loading reply, generating audio, or playing)
  useEffect(() => {
    if (isTalking && selectedGuide) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.8, duration: 800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          ]),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.3);
    }
  }, [isTalking, selectedGuide, pulseAnim, glowAnim]);

  const toggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await AsyncStorage.setItem('spirit_guides_muted', newMuted ? 'true' : 'false');
    if (newMuted && audioPlayerRef.current) {
      await audioPlayerRef.current.stop();
      setPlayingAudioIndex(null);
    }
  };

  const playAudio = async (audioBase64: string, messageIndex: number) => {
    if (isMuted) return;
    try {
      if (!audioBase64 || audioBase64.length < 100) return;
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
      }
      const player = new AudioPlayerManager();
      const audioUri = `data:audio/mpeg;base64,${audioBase64}`;
      await player.loadAndPlay(audioUri);
      audioPlayerRef.current = player;
      setPlayingAudioIndex(messageIndex);
      player.onPlaybackStatusChange((status) => {
        if (status.didJustFinish) {
          setPlayingAudioIndex(null);
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      setPlayingAudioIndex(null);
    }
  };

  const playAudioAndWait = (audioBase64: string, messageIndex: number, gapMs = 350): Promise<void> => {
    return new Promise(async (resolve) => {
      if (isMuted) return resolve();
      if (!audioBase64 || audioBase64.length < 100) return resolve();
      try {
        if (audioPlayerRef.current) {
          await audioPlayerRef.current.unload();
        }
        const player = new AudioPlayerManager();
        const audioUri = `data:audio/mpeg;base64,${audioBase64}`;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          setPlayingAudioIndex(null);
          setTimeout(resolve, gapMs);
        };
        player.onPlaybackStatusChange((status) => {
          if (status.didJustFinish) finish();
        });
        await player.loadAndPlay(audioUri);
        audioPlayerRef.current = player;
        setPlayingAudioIndex(messageIndex);
        // Fail-safe to avoid hanging the chain if no callback ever fires
        setTimeout(finish, 60_000);
      } catch (error) {
        console.error('playAudioAndWait error:', error);
        setPlayingAudioIndex(null);
        resolve();
      }
    });
  };

  const generateAndPlayAudio = async (
    text: string,
    guideName: string,
    language: string,
    messageIndex: number,
    onAudio?: (audioBase64: string) => void,
    voiceId?: string,
  ) => {
    if (isMuted) return;
    setGeneratingAudio(true);
    setAudioError(null);
    try {
      const body: any = { text, guide_name: guideName, language };
      // For custom (renamed) guides we MUST pass the voice_id explicitly,
      // otherwise the backend can't resolve "Mr. Testing" → masculine voice
      // and falls back to the default Aether (feminine) voice.
      if (voiceId) body.voice_id = voiceId;
      const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!data.success || !data.audio_base64) {
        setAudioError(data.error || 'Voice temporarily unavailable');
        return;
      }
      if (onAudio) onAudio(data.audio_base64);
      if (!isMuted) {
        await playAudio(data.audio_base64, messageIndex);
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      setAudioError('Voice generation failed');
    } finally {
      setGeneratingAudio(false);
    }
  };

  return {
    isMuted,
    toggleMute,
    playingAudioIndex,
    generatingAudio,
    audioError,
    setAudioError,
    isTalking,
    pulseAnim,
    glowAnim,
    playAudio,
    playAudioAndWait,
    generateAndPlayAudio,
  };
}
