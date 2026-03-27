import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface BinauralProgram {
  id: string;
  name: string;
  frequency_range: string;
  base_frequency: number;
  beat_frequency: number;
  benefits: string[];
  color: string;
}

export default function BinauralMeditation() {
  const router = useRouter();
  const [programs, setPrograms] = useState<BinauralProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<BinauralProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const audioPlayer = useAudioPlayer();

  useEffect(() => {
    loadPrograms();
  }, []);

  // Track session duration
  useEffect(() => {
    if (audioPlayer.state.isPlaying && sessionStartTime) {
      const interval = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [audioPlayer.state.isPlaying, sessionStartTime]);

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

  const handleProgramSelect = async (program: BinauralProgram) => {
    setSelectedProgram(program);
    
    // Show info about the program
    Alert.alert(
      program.name,
      `Frequency: ${program.frequency_range}\n\nBenefits:\n• ${program.benefits.join('\n• ')}\n\nNote: For best results, use headphones.`,
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  const startSession = async () => {
    if (!selectedProgram) return;

    try {
      // In production, load actual binaural beat audio
      // For now, we'll simulate the experience
      Alert.alert(
        'Binaural Session Starting',
        'Put on your headphones and find a comfortable position. The session will begin shortly.',
        [
          {
            text: 'Start',
            onPress: () => {
              setSessionStartTime(Date.now());
              setSessionDuration(0);
              // In production: audioPlayer.loadAudio(audioUrl);
              // Then: audioPlayer.play();
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Error starting session:', error);
      Alert.alert('Error', 'Failed to start meditation session');
    }
  };

  const stopSession = async () => {
    if (sessionStartTime && sessionDuration > 30) {
      // Save session if it was at least 30 seconds
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
        
        // Also save to AsyncStorage for local tracking
        const sessions = await AsyncStorage.getItem('meditation_sessions') || '[]';
        const sessionList = JSON.parse(sessions);
        sessionList.unshift({
          type: 'Binaural - ' + selectedProgram?.name,
          duration: Math.floor(sessionDuration / 60) + ' min',
          date: new Date().toISOString(),
        });
        await AsyncStorage.setItem('meditation_sessions', JSON.stringify(sessionList.slice(0, 50)));
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }

    audioPlayer.stop();
    setSessionStartTime(null);
    setSessionDuration(0);
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
  if (sessionStartTime) {
    return (
      <View style={styles.container}>
        <View style={styles.sessionContainer}>
          <View style={[styles.cosmicBackground, { backgroundColor: selectedProgram?.color + '20' }]}>
            <View style={styles.pulsingOrb}>
              <View style={[styles.orbOuter, { backgroundColor: selectedProgram?.color }]} />
              <View style={[styles.orbMiddle, { backgroundColor: selectedProgram?.color }]} />
              <View style={[styles.orbInner, { backgroundColor: selectedProgram?.color }]} />
            </View>
          </View>

          <View style={styles.sessionOverlay}>
            <Text style={styles.sessionTitle}>{selectedProgram?.name}</Text>
            <Text style={styles.sessionFrequency}>{selectedProgram?.frequency_range}</Text>
            
            <View style={styles.durationDisplay}>
              <Text style={styles.durationText}>{formatDuration(sessionDuration)}</Text>
              <Text style={styles.durationLabel}>meditation time</Text>
            </View>

            <View style={styles.waveformContainer}>
              <View style={styles.waveform}>
                {[...Array(15)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.wavebar,
                      {
                        height: 20 + Math.sin((Date.now() / 200) + i) * 30,
                        backgroundColor: selectedProgram?.color || '#7c3aed',
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.stopButton} onPress={stopSession}>
              <Ionicons name="stop" size={32} color="#fff" />
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
          <Text style={styles.infoTitle}>What are Binaural Beats?</Text>
          <Text style={styles.infoText}>
            Binaural beats synchronize your brainwaves to specific frequencies, enhancing
            meditation, relaxation, and mental clarity. Each ear receives a slightly different
            frequency, creating a perceived "beat" that influences brainwave activity.
          </Text>
          <Text style={styles.infoImportant}>🎧 Headphones Required</Text>
        </View>

        <Text style={styles.sectionTitle}>Choose a Frequency</Text>

        {programs.map((program) => (
          <TouchableOpacity
            key={program.id}
            style={[
              styles.programCard,
              selectedProgram?.id === program.id && styles.programCardActive,
            ]}
            onPress={() => handleProgramSelect(program)}
            activeOpacity={0.7}
          >
            <View style={[styles.programIcon, { backgroundColor: program.color }]}>
              <Ionicons name="pulse" size={32} color="#fff" />
            </View>
            <View style={styles.programInfo}>
              <Text style={styles.programName}>{program.name}</Text>
              <Text style={styles.programFrequency}>{program.frequency_range}</Text>
              <View style={styles.benefitsContainer}>
                {program.benefits.slice(0, 2).map((benefit, index) => (
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
        ))}

        {selectedProgram && (
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: selectedProgram.color }]}
            onPress={startSession}
          >
            <Ionicons name="play" size={24} color="#fff" />
            <Text style={styles.startButtonText}>Begin Meditation</Text>
          </TouchableOpacity>
        )}

        <View style={styles.noticeCard}>
          <Ionicons name="information-circle" size={24} color="#f59e0b" />
          <Text style={styles.noticeText}>
            Note: This is a demonstration. For production use, integrate actual binaural beat
            audio files (30-minute tracks) for each frequency range.
          </Text>
        </View>
      </ScrollView>
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
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
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
  programName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 4,
  },
  programFrequency: {
    fontSize: 14,
    color: '#b794f6',
    marginBottom: 8,
  },
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  benefitTag: {
    fontSize: 11,
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
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
    gap: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
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
  },
  pulsingOrb: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -100 }],
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.2,
  },
  orbMiddle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.4,
  },
  orbInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.6,
  },
  sessionOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
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
    marginBottom: 40,
  },
  durationDisplay: {
    alignItems: 'center',
    marginBottom: 40,
  },
  durationText: {
    fontSize: 64,
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
    height: 80,
    marginBottom: 40,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
  },
  wavebar: {
    width: 6,
    borderRadius: 3,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 12,
  },
  stopButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
