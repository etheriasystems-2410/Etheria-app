import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BackgroundImage } from '../../components/BackgroundImage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { AudioPlayerManager } from '../../utils/audioPlayer';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface TimerPreset {
  label: string;
  minutes: number;
}

const presets: TimerPreset[] = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '20 min', minutes: 20 },
  { label: '30 min', minutes: 30 },
];

const ambientSounds = [
  { id: 'rain', name: 'White Noise', icon: 'rainy' },
  { id: 'forest', name: 'Forest Sounds', icon: 'leaf' },
  { id: 'singing-bowl', name: 'Harmonious Note', icon: 'musical-notes' },
  { id: 'thunder', name: 'Thunderstorm', icon: 'thunderstorm' },
  { id: 'wind', name: 'Wind', icon: 'cloud' },
  { id: 'stream', name: 'Flowing Stream', icon: 'water-outline' },
  { id: 'silence', name: 'Silence', icon: 'volume-mute' },
];

export default function TimedMeditation() {
  const router = useRouter();
  const [selectedMinutes, setSelectedMinutes] = useState(10);
  const [selectedSound, setSelectedSound] = useState('ocean');
  const [isActive, setIsActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600); // seconds
  const [isLoadingSound, setIsLoadingSound] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);
  
  const audioPlayerRef = useRef<AudioPlayerManager | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Stop all audio immediately
  const stopAllAudio = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioPlayerRef.current) {
      try {
        await audioPlayerRef.current.unload();
      } catch (e) {
        console.log('Audio cleanup error:', e);
      }
      audioPlayerRef.current = null;
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  // Handle back button - stop audio before navigating
  const handleBack = async () => {
    await stopAllAudio();
    setIsActive(false);
    router.push('/meditation');
  };

  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((time) => time - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isActive) {
      // Session complete
      setIsActive(false);
      stopSound();
      Alert.alert('Session Complete', 'Your meditation session has ended. Take a moment to return to awareness.');
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadAndPlaySound = async () => {
    if (selectedSound === 'silence') {
      return; // No sound for silence
    }
    
    setIsLoadingSound(true);
    setSoundError(null);
    
    try {
      // Generate ambient sound (request 60 seconds, we'll loop it seamlessly)
      const response = await fetch(
        `${BACKEND_URL}/api/meditation/ambient/generate/${selectedSound}?duration=60&loop=1`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load ambient sound');
      }
      
      const data = await response.json();
      
      if (!data.audio_base64) {
        throw new Error('No audio data received');
      }
      
      // Unload any existing audio
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
      }
      
      // Create and play audio with looping
      const player = new AudioPlayerManager();
      const audioUri = `data:audio/wav;base64,${data.audio_base64}`;
      await player.loadAndPlay(audioUri, { loop: true, volume: 0.6 });
      
      audioPlayerRef.current = player;
      console.log('Ambient sound playing:', selectedSound);
      
    } catch (error) {
      console.error('Error loading ambient sound:', error);
      setSoundError('Could not load ambient sound');
    } finally {
      setIsLoadingSound(false);
    }
  };

  const stopSound = async () => {
    await stopAllAudio();
  };

  const startMeditation = async () => {
    setTimeRemaining(selectedMinutes * 60);
    setIsActive(true);
    await loadAndPlaySound();
  };

  const pauseMeditation = async () => {
    setIsActive(false);
    if (audioPlayerRef.current) {
      await audioPlayerRef.current.pause();
    }
  };

  const resumeMeditation = async () => {
    setIsActive(true);
    if (audioPlayerRef.current) {
      await audioPlayerRef.current.play();
    }
  };

  const resetMeditation = async () => {
    setIsActive(false);
    setTimeRemaining(selectedMinutes * 60);
    await stopAllAudio();
  };

  const getProgress = () => {
    const total = selectedMinutes * 60;
    return ((total - timeRemaining) / total) * 100;
  };

  return (
    <BackgroundImage 
      source={require('../../assets/backgrounds/timed-bg.jpg')}
      opacity={0.3}
      overlayColor="rgba(15, 3, 33, 0.7)"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calming Timed Meditations</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isActive ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Duration</Text>
              <View style={styles.presetsRow}>
                {presets.map((preset) => (
                  <TouchableOpacity
                    key={preset.minutes}
                    style={[
                      styles.presetButton,
                      selectedMinutes === preset.minutes && styles.presetButtonActive,
                    ]}
                    onPress={() => {
                      setSelectedMinutes(preset.minutes);
                      setTimeRemaining(preset.minutes * 60);
                    }}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        selectedMinutes === preset.minutes && styles.presetTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ambient Sound</Text>
              <View style={styles.soundsGrid}>
                {ambientSounds.map((sound) => (
                  <TouchableOpacity
                    key={sound.id}
                    style={[
                      styles.soundCard,
                      selectedSound === sound.id && styles.soundCardActive,
                    ]}
                    onPress={() => setSelectedSound(sound.id)}
                  >
                    <Ionicons
                      name={sound.icon as any}
                      size={32}
                      color={selectedSound === sound.id ? '#fff' : '#c4b5fd'}
                    />
                    <Text
                      style={[
                        styles.soundName,
                        selectedSound === sound.id && styles.soundNameActive,
                      ]}
                    >
                      {sound.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.activeSession}>
            <View style={styles.timerCircle}>
              <View
                style={[
                  styles.progressRing,
                  {
                    transform: [{ rotate: `${(getProgress() / 100) * 360}deg` }],
                  },
                ]}
              />
              <View style={styles.timerInner}>
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
                <Text style={styles.timerLabel}>remaining</Text>
              </View>
            </View>

            <View style={styles.soundIndicator}>
              {isLoadingSound ? (
                <>
                  <ActivityIndicator size="small" color="#c4b5fd" />
                  <Text style={styles.currentSound}>Loading sound...</Text>
                </>
              ) : soundError ? (
                <>
                  <Ionicons name="warning" size={20} color="#f59e0b" />
                  <Text style={[styles.currentSound, { color: '#f59e0b' }]}>{soundError}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="volume-medium" size={20} color="#10b981" />
                  <Text style={styles.currentSound}>
                    {ambientSounds.find((s) => s.id === selectedSound)?.name}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        <View style={styles.controls}>
          {!isActive ? (
            <TouchableOpacity style={styles.startButton} onPress={startMeditation}>
              <Ionicons name="play" size={32} color="#fff" />
              <Text style={styles.startButtonText}>Begin Meditation</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.activeControls}>
              <TouchableOpacity style={styles.controlButton} onPress={pauseMeditation}>
                <Ionicons name="pause" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.controlButton, styles.stopButton]} onPress={resetMeditation}>
                <Ionicons name="stop" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#2d1b4e',
    borderWidth: 2,
    borderColor: '#2d1b4e',
  },
  presetButtonActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  presetText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c4b5fd',
  },
  presetTextActive: {
    color: '#fff',
  },
  soundsGrid: {
    gap: 12,
  },
  soundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#2d1b4e',
    gap: 12,
  },
  soundCardActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  soundName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#c4b5fd',
  },
  soundNameActive: {
    color: '#fff',
  },
  activeSession: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  timerCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#1a0033',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: '#2d1b4e',
    position: 'relative',
  },
  progressRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 140,
    borderWidth: 8,
    borderColor: '#7c3aed',
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  timerInner: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  timerLabel: {
    fontSize: 16,
    color: '#c4b5fd',
    marginTop: 8,
  },
  soundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  currentSound: {
    fontSize: 16,
    color: '#c4b5fd',
  },
  controls: {
    marginTop: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 25,
    gap: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: '#dc2626',
  },
});
