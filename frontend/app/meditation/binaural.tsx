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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import { Paywall } from '../../components/Paywall';
import { AudioPlayerManager, setupAudioMode } from '../../utils/audioPlayer';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface BinauralProgram {
  id: string;
  name: string;
  frequency_range: string;
  base_frequency: number;
  beat_frequency: number;
  benefits: string[];
  color: string;
  description?: string;
}

export default function BinauralMeditation() {
  const router = useRouter();
  const { isPremium } = useAuth();
  const [programs, setPrograms] = useState<BinauralProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<BinauralProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  
  const audioPlayerRef = useRef<AudioPlayerManager | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isPaused, setIsPaused] = useState(false);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    loadPrograms();
    setupAudioMode();
    
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.unload();
      }
    };
  }, []);

  // Pulse animation for active session
  useEffect(() => {
    if (isPlaying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isPlaying]);

  // Track session duration
  useEffect(() => {
    if (isPlaying && sessionStartTime) {
      const interval = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, sessionStartTime]);

  const loadPrograms = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/meditation/binaural/frequencies`);
      const data = await response.json();
      setPrograms(data);
    } catch (error) {
      console.error('Error loading programs:', error);
      Alert.alert('Error', 'Failed to load binaural programs');
    } finally {
      setLoading(false);
    }
  };

  const handleProgramSelect = (program: BinauralProgram) => {
    // Schumann is free, others require premium
    if (program.id === 'schumann' || isPremium) {
      setSelectedProgram(program);
    } else {
      setShowPaywall(true);
    }
  };

  const startSession = async () => {
    if (!selectedProgram) return;

    setGeneratingAudio(true);
    
    try {
      // Use streaming URL for native audio playback
      const streamingUrl = `${BACKEND_URL}/api/meditation/binaural/stream/${selectedProgram.id}?duration=30`;
      console.log('Binaural streaming URL:', streamingUrl);
      
      // Unload previous player
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
      }
      
      // Create new audio player and play using streaming URL
      const player = new AudioPlayerManager();
      await player.loadAndPlay(streamingUrl, {
        loop: true,
        volume: 0.8,
      });
      
      audioPlayerRef.current = player;
      setIsPlaying(true);
      setSessionStartTime(Date.now());
      setSessionDuration(0);
      console.log('Binaural beat playing from stream');
      
    } catch (error) {
      console.error('Error starting session:', error);
      Alert.alert('Error', 'Failed to start meditation session. Please try again.');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const stopSession = async () => {
    try {
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.stop();
        await audioPlayerRef.current.unload();
        audioPlayerRef.current = null;
      }
      
      // Save session if it was at least 30 seconds
      if (sessionStartTime && sessionDuration > 30) {
        try {
          await fetch(`${BACKEND_URL}/api/meditation/session/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'binaural',
              frequency: selectedProgram?.id,
              duration_seconds: sessionDuration,
              timestamp: new Date().toISOString(),
            }),
          });
          
          // Save to AsyncStorage
          const sessions = await AsyncStorage.getItem('meditation_sessions') || '[]';
          const sessionList = JSON.parse(sessions);
          sessionList.unshift({
            type: 'Binaural - ' + selectedProgram?.name,
            duration: Math.floor(sessionDuration / 60) + ' min',
            date: new Date().toISOString(),
          });
          await AsyncStorage.setItem('meditation_sessions', JSON.stringify(sessionList.slice(0, 50)));
          
          Alert.alert('Session Complete', `Great session! You meditated for ${formatDuration(sessionDuration)}.`);
        } catch (error) {
          console.error('Error saving session:', error);
        }
      }
    } catch (error) {
      console.error('Error stopping session:', error);
    } finally {
      setIsPlaying(false);
      setIsPaused(false);
      setSessionStartTime(null);
      setSessionDuration(0);
    }
  };

  const togglePause = async () => {
    if (!audioPlayerRef.current) return;
    
    try {
      if (isPaused) {
        await audioPlayerRef.current.play();
        setIsPaused(false);
      } else {
        await audioPlayerRef.current.pause();
        setIsPaused(true);
      }
    } catch (error) {
      console.error('Error toggling pause:', error);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.setVolume(newVolume);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#b794f6" />
      </View>
    );
  }

  // Active session view
  if (isPlaying && selectedProgram) {
    return (
      <View style={styles.container}>
        <View style={styles.sessionContainer}>
          <View style={[styles.cosmicBackground, { backgroundColor: selectedProgram.color + '15' }]}>
            <Animated.View 
              style={[
                styles.pulsingOrb,
                { transform: [{ scale: isPaused ? 1 : pulseAnim }] }
              ]}
            >
              <View style={[styles.orbOuter, { backgroundColor: selectedProgram.color, opacity: isPaused ? 0.1 : 0.15 }]} />
              <View style={[styles.orbMiddle, { backgroundColor: selectedProgram.color, opacity: isPaused ? 0.15 : 0.25 }]} />
              <View style={[styles.orbInner, { backgroundColor: selectedProgram.color, opacity: isPaused ? 0.25 : 0.4 }]} />
            </Animated.View>
          </View>

          <View style={styles.sessionOverlay}>
            <View style={styles.sessionHeader}>
              <Ionicons name="headset" size={32} color="#b794f6" />
              <Text style={styles.headphonesReminder}>
                {isPaused ? 'Paused' : 'Headphones Active'}
              </Text>
            </View>
            
            <Text style={styles.sessionTitle}>{selectedProgram.name}</Text>
            <Text style={styles.sessionFrequency}>
              {selectedProgram.beat_frequency} Hz Binaural Beat
            </Text>
            
            <View style={styles.durationDisplay}>
              <Text style={styles.durationText}>{formatDuration(sessionDuration)}</Text>
              <Text style={styles.durationLabel}>meditation time</Text>
            </View>

            {/* Waveform visualization - static when paused */}
            <View style={styles.waveformContainer}>
              <View style={styles.waveform}>
                {[...Array(20)].map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.wavebar,
                      {
                        height: isPaused ? 20 : 15 + Math.abs(Math.sin((Date.now() / 300) + i * 0.5)) * 40,
                        backgroundColor: selectedProgram.color,
                        opacity: isPaused ? 0.3 : 0.4 + Math.abs(Math.sin((Date.now() / 300) + i * 0.5)) * 0.6,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Media Player Controls */}
            <View style={styles.mediaPlayerControls}>
              {/* Play/Pause Button */}
              <TouchableOpacity 
                style={[styles.playPauseButton, { backgroundColor: selectedProgram.color }]} 
                onPress={togglePause}
              >
                <Ionicons 
                  name={isPaused ? 'play' : 'pause'} 
                  size={40} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>

            {/* Volume Control */}
            <View style={styles.volumeContainer}>
              <Ionicons name="volume-low" size={20} color="#9f7aea" />
              <View style={styles.volumeSliderContainer}>
                <View style={styles.volumeTrack}>
                  <View 
                    style={[
                      styles.volumeFill, 
                      { width: `${volume * 100}%`, backgroundColor: selectedProgram.color }
                    ]} 
                  />
                </View>
                <View style={styles.volumeButtonsContainer}>
                  {[0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[
                        styles.volumeButton,
                        volume >= v && { backgroundColor: selectedProgram.color + '40' }
                      ]}
                      onPress={() => handleVolumeChange(v)}
                    >
                      <View style={styles.volumeDot} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Ionicons name="volume-high" size={20} color="#9f7aea" />
            </View>

            <View style={styles.frequencyInfo}>
              <View style={styles.freqBox}>
                <Text style={styles.freqLabel}>Left Ear</Text>
                <Text style={styles.freqValue}>{selectedProgram.base_frequency} Hz</Text>
              </View>
              <View style={styles.freqDivider} />
              <View style={styles.freqBox}>
                <Text style={styles.freqLabel}>Right Ear</Text>
                <Text style={styles.freqValue}>{selectedProgram.base_frequency + selectedProgram.beat_frequency} Hz</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.stopButton} onPress={stopSession}>
              <Ionicons name="stop" size={24} color="#fff" />
              <Text style={styles.stopButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Binaural Meditation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="headset" size={40} color="#b794f6" />
          <Text style={styles.infoTitle}>Real Binaural Beats</Text>
          <Text style={styles.infoText}>
            Experience actual binaural beat audio that synchronizes your brainwaves. 
            Each ear receives a different frequency, creating a perceived "beat" that 
            entrains your brain to the desired state.
          </Text>
          <Text style={styles.infoImportant}>🎧 Stereo Headphones Required</Text>
        </View>

        <Text style={styles.sectionTitle}>Choose Your Frequency</Text>

        {programs.map((program) => {
          const isLocked = program.id !== 'schumann' && !isPremium;
          const isSchumann = program.id === 'schumann';
          
          return (
            <TouchableOpacity
              key={program.id}
              style={[
                styles.programCard,
                selectedProgram?.id === program.id && styles.programCardActive,
                isSchumann && styles.schumannCard,
              ]}
              onPress={() => handleProgramSelect(program)}
              activeOpacity={0.7}
            >
              <View style={[styles.programIcon, { backgroundColor: program.color }]}>
                <Ionicons 
                  name={isSchumann ? 'earth' : 'pulse'} 
                  size={32} 
                  color="#fff" 
                />
              </View>
              <View style={styles.programInfo}>
                <View style={styles.programNameRow}>
                  <Text style={styles.programName}>{program.name}</Text>
                  {isSchumann && (
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeText}>FREE</Text>
                    </View>
                  )}
                  {isLocked && (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="lock-closed" size={12} color="#ffd700" />
                    </View>
                  )}
                </View>
                <Text style={styles.programFrequency}>{program.frequency_range}</Text>
                {program.description && (
                  <Text style={styles.programDescription} numberOfLines={2}>
                    {program.description}
                  </Text>
                )}
                <View style={styles.benefitsContainer}>
                  {program.benefits.slice(0, 3).map((benefit, index) => (
                    <Text key={index} style={styles.benefitTag}>
                      {benefit}
                    </Text>
                  ))}
                </View>
              </View>
              {selectedProgram?.id === program.id && (
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              )}
            </TouchableOpacity>
          );
        })}

        {selectedProgram && (
          <TouchableOpacity
            style={[
              styles.startButton, 
              { backgroundColor: selectedProgram.color },
              generatingAudio && styles.startButtonDisabled,
            ]}
            onPress={startSession}
            disabled={generatingAudio}
          >
            {generatingAudio ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.startButtonText}>Generating Audio...</Text>
              </>
            ) : (
              <>
                <Ionicons name="play" size={24} color="#fff" />
                <Text style={styles.startButtonText}>Begin {selectedProgram.name}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.techCard}>
          <Ionicons name="information-circle" size={24} color="#b794f6" />
          <View style={styles.techInfo}>
            <Text style={styles.techTitle}>How It Works</Text>
            <Text style={styles.techText}>
              Your left ear receives {selectedProgram?.base_frequency || 200} Hz while your right ear receives{' '}
              {selectedProgram ? selectedProgram.base_frequency + selectedProgram.beat_frequency : 207.83} Hz.
              Your brain perceives the difference as a {selectedProgram?.beat_frequency || 7.83} Hz "beat",
              entraining your brainwaves to that frequency.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="Premium Binaural Frequencies"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a0033',
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
  infoCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  infoImportant: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b794f6',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 16,
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2d1b4e',
  },
  programCardActive: {
    borderColor: '#7c3aed',
  },
  schumannCard: {
    borderColor: '#10b981',
    borderWidth: 2,
  },
  programIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  programInfo: {
    flex: 1,
  },
  programNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  programName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  freeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  freeBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  premiumBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    padding: 4,
    borderRadius: 6,
  },
  programFrequency: {
    fontSize: 14,
    color: '#b794f6',
    marginBottom: 4,
  },
  programDescription: {
    fontSize: 12,
    color: '#9f7aea',
    marginBottom: 8,
  },
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  benefitTag: {
    fontSize: 10,
    color: '#c4b5fd',
    backgroundColor: '#2d1b4e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 25,
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  techCard: {
    flexDirection: 'row',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d1b4e',
    gap: 12,
  },
  techInfo: {
    flex: 1,
  },
  techTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b794f6',
    marginBottom: 4,
  },
  techText: {
    fontSize: 12,
    color: '#c4b5fd',
    lineHeight: 18,
  },
  sessionContainer: {
    flex: 1,
  },
  cosmicBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingOrb: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbOuter: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.15,
  },
  orbMiddle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.25,
  },
  orbInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    opacity: 0.4,
  },
  sessionOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  headphonesReminder: {
    fontSize: 14,
    color: '#b794f6',
    fontWeight: '600',
  },
  sessionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
    marginBottom: 8,
  },
  sessionFrequency: {
    fontSize: 18,
    color: '#c4b5fd',
    marginBottom: 32,
  },
  durationDisplay: {
    alignItems: 'center',
    marginBottom: 32,
  },
  durationText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  durationLabel: {
    fontSize: 16,
    color: '#c4b5fd',
    marginTop: 8,
  },
  waveformContainer: {
    width: '100%',
    height: 60,
    marginBottom: 32,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
  },
  wavebar: {
    width: 4,
    borderRadius: 2,
  },
  frequencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 27, 78, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
  },
  freqBox: {
    flex: 1,
    alignItems: 'center',
  },
  freqLabel: {
    fontSize: 12,
    color: '#9f7aea',
    marginBottom: 4,
  },
  freqValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  freqDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#7c3aed',
    marginHorizontal: 16,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
    gap: 12,
  },
  stopButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  mediaPlayerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 20,
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  volumeSliderContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  volumeTrack: {
    height: 6,
    backgroundColor: 'rgba(45, 27, 78, 0.8)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    borderRadius: 3,
  },
  volumeButtonsContainer: {
    position: 'absolute',
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  volumeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
});
