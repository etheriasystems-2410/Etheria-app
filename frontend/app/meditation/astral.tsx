import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { BackgroundImage } from '../../components/BackgroundImage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBottomSafePad } from '../../hooks/useBottomSafePad';
import { useAuth } from '../../contexts/AuthContext';
import { Paywall } from '../../components/Paywall';
import { AudioPlayerManager, setupAudioMode } from '../../utils/audioPlayer';
import AmbientMusicMixer from '../../components/AmbientMusicMixer';
import LightTherapyController from '../../components/LightTherapyController';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface AstralLevel {
  id: string;
  name: string;
  description: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const levels: AstralLevel[] = [
  {
    id: 'intro',
    name: 'Introduction to Astral Travel',
    description: 'Learn the basics of out-of-body experiences',
    duration: 15,
    difficulty: 'beginner',
  },
  {
    id: 'body-scan',
    name: 'Deep Body Relaxation',
    description: 'Master the vibrational state',
    duration: 20,
    difficulty: 'beginner',
  },
  {
    id: 'separation',
    name: 'Consciousness Separation',
    description: 'Practice leaving your physical form',
    duration: 25,
    difficulty: 'intermediate',
  },
  {
    id: 'navigation',
    name: 'Astral Navigation',
    description: 'Explore the astral realm with control',
    duration: 30,
    difficulty: 'advanced',
  },
];

export default function AstralTravel() {
  const router = useRouter();
  const bottomPad = useBottomSafePad();
  const { isPremium } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<AstralLevel | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Audio control state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const audioPlayerRef = useRef<AudioPlayerManager | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const breatheAnim = useRef(new Animated.Value(1)).current;

  // Check premium access on mount
  React.useEffect(() => {
    if (!isPremium) {
      setShowPaywall(true);
    }
    setupAudioMode();
    return () => {
      stopSession();
    };
  }, [isPremium]);

  // Breathing animation effect during active session
  useEffect(() => {
    if (sessionActive && isPlaying && !isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.3,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [sessionActive, isPlaying, isPaused]);

  // Timer Countdown Effect
  useEffect(() => {
    if (sessionActive && isPlaying && !isPaused && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current as any);
            stopSession();
            Alert.alert(
              'Session Complete',
              'Your astral journey has concluded. Gently return to your physical awareness.'
            );
            return 0;
          }
          return prev - 1;
        });
        setSessionDuration((prev) => prev + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [sessionActive, isPlaying, isPaused, timeRemaining]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '#10b981';
      case 'intermediate':
        return '#f59e0b';
      case 'advanced':
        return '#ef4444';
      default:
        return '#8b5cf6';
    }
  };

  const startSession = async () => {
    if (!selectedLevel) return;

    setSessionActive(true);
    setIsLoadingAudio(true);
    setTimeRemaining(selectedLevel.duration * 60);
    setSessionDuration(0);

    try {
      // Use theta binaural / astral frequency stream
      const streamingUrl = `${BACKEND_URL}/api/meditation/binaural/stream/theta?duration=${selectedLevel.duration}`;

      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
      }

      const player = new AudioPlayerManager();
      await player.loadAndPlay(streamingUrl, {
        loop: true,
        volume: isMuted ? 0 : volume,
      });

      audioPlayerRef.current = player;
      setIsPlaying(true);
      setIsPaused(false);
    } catch (error) {
      console.error('Error playing astral sound:', error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const stopSession = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioPlayerRef.current) {
      try {
        await audioPlayerRef.current.unload();
      } catch (e) {
        console.warn('Audio cleanup error:', e);
      }
      audioPlayerRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setSessionActive(false);
  };

  const togglePause = async () => {
    if (!audioPlayerRef.current) return;
    if (isPaused) {
      await audioPlayerRef.current.play();
      setIsPaused(false);
    } else {
      await audioPlayerRef.current.pause();
      setIsPaused(true);
    }
  };

  const toggleMute = async () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioPlayerRef.current) {
      await audioPlayerRef.current.setVolume(nextMute ? 0 : volume);
    }
  };

  const handleVolumeChange = async (v: number) => {
    setVolume(v);
    setIsMuted(false);
    if (audioPlayerRef.current) {
      await audioPlayerRef.current.setVolume(v);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (sessionActive && selectedLevel) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.sessionContainer}>
          <View style={styles.cosmicBackground}>
            <View style={styles.orb1} />
            <View style={styles.orb2} />
            <View style={styles.orb3} />
          </View>

          <View style={styles.sessionContent}>
            <Text style={styles.sessionTitle}>{selectedLevel.name}</Text>
            <Text style={styles.sessionInstruction}>
              Close your eyes, relax your body completely, and follow the guidance...
            </Text>

            {/* Timer Display */}
            <View style={styles.timerDisplay}>
              <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              <Text style={styles.timerSubtext}>remaining</Text>
            </View>

            {/* Breathing Circle */}
            <Animated.View
              style={[
                styles.breathingCircle,
                { transform: [{ scale: breatheAnim }] },
              ]}
            >
              <View style={styles.breathingInner}>
                <Ionicons name="planet" size={32} color="#fff" />
                <Text style={styles.breathingText}>Breathe</Text>
              </View>
            </Animated.View>

            {isLoadingAudio ? (
              <View style={styles.audioStatusRow}>
                <ActivityIndicator size="small" color="#c4b5fd" />
                <Text style={styles.audioStatusText}>Preparing audio frequency...</Text>
              </View>
            ) : null}

            {/* Standard Media Player Controls */}
            <View style={styles.audioControlsRow}>
              <TouchableOpacity
                style={[styles.audioCtrlBtn, isMuted && styles.audioCtrlBtnActive]}
                onPress={toggleMute}
              >
                <Ionicons
                  name={isMuted ? 'volume-mute' : 'volume-high'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playPauseBtn}
                onPress={togglePause}
              >
                <Ionicons
                  name={isPaused ? 'play' : 'pause'}
                  size={36}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stopCtrlBtn}
                onPress={stopSession}
              >
                <Ionicons name="stop" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Volume Presets */}
            <View style={styles.volumeRow}>
              <Ionicons name="volume-low" size={16} color="#9f7aea" />
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[
                    styles.volumePill,
                    volume >= v && !isMuted && styles.volumePillActive,
                  ]}
                  onPress={() => handleVolumeChange(v)}
                >
                  <Text style={styles.volumePillText}>{Math.round(v * 100)}%</Text>
                </TouchableOpacity>
              ))}
              <Ionicons name="volume-high" size={16} color="#9f7aea" />
            </View>

            {/* Ambient Music & Light Therapy */}
            <View style={{ width: '100%', marginTop: 16 }}>
              <AmbientMusicMixer
                active={isPlaying}
                paused={isPaused}
                accentColor="#7c3aed"
              />
              <LightTherapyController
                active={isPlaying}
                paused={isPaused}
                accentColor="#a855f7"
                autoFrequencyHz={6}
              />
            </View>

            <TouchableOpacity style={styles.endButton} onPress={stopSession}>
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={styles.endButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <BackgroundImage 
      source={require('../../assets/backgrounds/astral-bg.jpg')}
      opacity={0.3}
      overlayColor="rgba(15, 3, 33, 0.7)"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/meditation')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Astral Travel Self-Study</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={32} color="#f59e0b" />
          <Text style={styles.warningTitle}>Important Guidelines</Text>
          <Text style={styles.warningText}>
            {`• Practice in a safe, comfortable space\n• Never attempt while driving or operating machinery\n• Start with beginner levels\n• Set a clear intention to return to your body`}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Choose Your Level</Text>

        {levels.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.levelCard,
              selectedLevel?.id === level.id && styles.levelCardActive,
            ]}
            onPress={() => setSelectedLevel(level)}
            activeOpacity={0.7}
          >
            <View style={styles.levelHeader}>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(level.difficulty) },
                ]}
              >
                <Text style={styles.difficultyText}>
                  {level.difficulty.toUpperCase()}
                </Text>
              </View>
              <View style={styles.durationBadge}>
                <Ionicons name="time" size={16} color="#c4b5fd" />
                <Text style={styles.durationText}>{level.duration} min</Text>
              </View>
            </View>
            <Text style={styles.levelName}>{level.name}</Text>
            <Text style={styles.levelDescription}>{level.description}</Text>
            {selectedLevel?.id === level.id && (
              <View style={styles.selectedIndicator}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.selectedText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {selectedLevel && (
          <TouchableOpacity style={styles.startButton} onPress={startSession}>
            <Ionicons name="planet" size={24} color="#fff" />
            <Text style={styles.startButtonText}>Begin Astral Journey</Text>
          </TouchableOpacity>
        )}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips for Success</Text>
          <Text style={styles.tipText}>✨ Practice regularly at the same time</Text>
          <Text style={styles.tipText}>✨ Keep a journal of your experiences</Text>
          <Text style={styles.tipText}>✨ Stay patient - mastery takes time</Text>
          <Text style={styles.tipText}>✨ Trust your intuition and inner guidance</Text>
        </View>
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          if (!isPremium) {
            router.back();
          }
        }}
        feature="Astral Travel Practice"
      />
    </BackgroundImage>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  backgroundImage: {
    opacity: 0.25,
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 3, 33, 0.75)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(26, 0, 51, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  content: {
    padding: 12,
  },
  warningCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f59e0b',
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 16,
  },
  levelCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2d1b4e',
  },
  levelCardActive: {
    borderColor: '#7c3aed',
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  levelName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  levelDescription: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 20,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  selectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 25,
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  tipsCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 24,
  },
  sessionContainer: {
    flex: 1,
    position: 'relative',
  },
  cosmicBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0015',
  },
  orb1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#7c3aed',
    opacity: 0.1,
    top: 100,
    left: -50,
  },
  orb2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#a855f7',
    opacity: 0.15,
    bottom: 150,
    right: -30,
  },
  orb3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#c084fc',
    opacity: 0.2,
    top: '50%',
    right: 50,
  },
  sessionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
    marginBottom: 16,
  },
  sessionInstruction: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 60,
    lineHeight: 24,
  },
  breathingCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#7c3aed',
    opacity: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  breathingInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  endButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#2d1b4e',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  timerSubtext: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  audioStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  audioStatusText: {
    color: '#c4b5fd',
    fontSize: 14,
  },
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginVertical: 16,
  },
  audioCtrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(124, 58, 237, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioCtrlBtnActive: {
    backgroundColor: '#ef4444',
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopCtrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  volumePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(45, 27, 78, 0.8)',
  },
  volumePillActive: {
    backgroundColor: '#7c3aed',
  },
  volumePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e9d5ff',
  },
});
