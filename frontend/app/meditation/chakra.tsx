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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { AudioPlayerManager } from '../../utils/audioPlayer';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Chakra {
  id: string;
  name: string;
  sanskrit: string;
  frequency: number;
  color: string;
  location: string;
  element: string;
  benefits: string[];
  affirmation: string;
}

export default function ChakraMeditation() {
  const router = useRouter();
  const [chakras, setChakras] = useState<Chakra[]>([]);
  const [selectedChakra, setSelectedChakra] = useState<Chakra | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [showSession, setShowSession] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [isRealignAll, setIsRealignAll] = useState(false);
  
  const tonePlayerRef = useRef<AudioPlayerManager | null>(null);
  const voicePlayerRef = useRef<AudioPlayerManager | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    fetchChakras();
    return () => {
      stopAllAudio();
    };
  }, []);

  // Keep ref synced with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const fetchChakras = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/meditation/chakra/list`);
      if (!response.ok) {
        throw new Error('Failed to fetch chakras');
      }
      const data = await response.json();
      setChakras(data);
    } catch (error) {
      console.error('Error fetching chakras:', error);
      // Use default chakras if fetch fails
      setChakras([
        { id: 'root', name: 'Root Chakra', sanskrit: 'Muladhara', frequency: 396, color: '#dc2626', location: 'Base of spine', element: 'Earth', benefits: ['Grounding', 'Security'], affirmation: 'I am safe.' },
        { id: 'sacral', name: 'Sacral Chakra', sanskrit: 'Svadhisthana', frequency: 417, color: '#ea580c', location: 'Lower abdomen', element: 'Water', benefits: ['Creativity', 'Emotions'], affirmation: 'I embrace creativity.' },
        { id: 'solar', name: 'Solar Plexus', sanskrit: 'Manipura', frequency: 528, color: '#eab308', location: 'Upper abdomen', element: 'Fire', benefits: ['Confidence', 'Power'], affirmation: 'I am confident.' },
        { id: 'heart', name: 'Heart Chakra', sanskrit: 'Anahata', frequency: 639, color: '#16a34a', location: 'Center of chest', element: 'Air', benefits: ['Love', 'Compassion'], affirmation: 'I give and receive love.' },
        { id: 'throat', name: 'Throat Chakra', sanskrit: 'Vishuddha', frequency: 741, color: '#0ea5e9', location: 'Throat', element: 'Ether', benefits: ['Communication', 'Truth'], affirmation: 'I speak my truth.' },
        { id: 'third-eye', name: 'Third Eye', sanskrit: 'Ajna', frequency: 852, color: '#6366f1', location: 'Between eyebrows', element: 'Light', benefits: ['Intuition', 'Wisdom'], affirmation: 'I trust my intuition.' },
        { id: 'crown', name: 'Crown Chakra', sanskrit: 'Sahasrara', frequency: 963, color: '#9333ea', location: 'Top of head', element: 'Thought', benefits: ['Spiritual connection', 'Unity'], affirmation: 'I am connected to the divine.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopAllAudio = async () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    try {
      if (tonePlayerRef.current) {
        await tonePlayerRef.current.unload();
        tonePlayerRef.current = null;
      }
      if (voicePlayerRef.current) {
        await voicePlayerRef.current.unload();
        voicePlayerRef.current = null;
      }
    } catch (e) {
      console.log('Audio cleanup error:', e);
    }
  };

  const handleBack = async () => {
    await stopAllAudio();
    if (showSession) {
      setShowSession(false);
      setScript(null);
      setIsRealignAll(false);
    } else {
      router.back();
    }
  };

  const startSingleChakraMeditation = async (chakra: Chakra) => {
    setSelectedChakra(chakra);
    setIsRealignAll(false);
    setIsGenerating(true);
    setShowSession(true);
    setScript(null);

    try {
      // Load chakra tone (5 minutes = 300 seconds)
      setLoadingStage('Loading chakra frequency tone...');
      console.log('Loading tone for chakra:', chakra.id);
      const toneResponse = await fetch(
        `${BACKEND_URL}/api/meditation/chakra/tone/${chakra.id}?duration=300`
      );
      
      if (!toneResponse.ok) {
        throw new Error('Failed to load chakra tone');
      }
      
      const toneData = await toneResponse.json();
      if (!toneData.audio_base64) {
        throw new Error('No tone audio data received');
      }
      
      console.log('Tone data received, loading player...');
      const tonePlayer = new AudioPlayerManager();
      await tonePlayer.loadAndPlay(
        `data:audio/wav;base64,${toneData.audio_base64}`,
        { loop: false, volume: 0.8 }
      );
      tonePlayerRef.current = tonePlayer;
      console.log('Tone player loaded and playing');

      // Set playing state
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsGenerating(false);
      setLoadingStage('');
      
      // Wait for tone to complete
      console.log('Waiting for chakra tone to complete...');
      await tonePlayer.waitForCompletion(360000); // 6 minute max
      
      console.log('Chakra tone meditation complete');
      if (isPlayingRef.current) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        await stopAllAudio();
        Alert.alert('Session Complete', 'Your chakra meditation has ended. Take a moment to return to awareness.');
      }

    } catch (error) {
      console.error('Error starting meditation:', error);
      Alert.alert('Error', 'Failed to start meditation. Please try again.');
      setShowSession(false);
      setIsGenerating(false);
      setLoadingStage('');
    }
  };

  const startRealignAllMeditation = async () => {
    setIsRealignAll(true);
    setSelectedChakra(null);
    setIsGenerating(true);
    setShowSession(true);
    setScript(null);

    try {
      // Load morphing chakra tone (10 minutes = 600 seconds)
      setLoadingStage('Loading chakra frequency progression...');
      console.log('Loading realign tone...');
      const toneResponse = await fetch(
        `${BACKEND_URL}/api/meditation/chakra/realign-tone?duration=600`
      );
      
      if (!toneResponse.ok) {
        throw new Error('Failed to load realignment tone');
      }
      
      const toneData = await toneResponse.json();
      if (!toneData.audio_base64) {
        throw new Error('No tone audio data received');
      }
      
      console.log('Realign tone data received, loading player...');
      const tonePlayer = new AudioPlayerManager();
      await tonePlayer.loadAndPlay(
        `data:audio/wav;base64,${toneData.audio_base64}`,
        { loop: false, volume: 0.8 }
      );
      tonePlayerRef.current = tonePlayer;
      console.log('Realign tone player loaded and playing');

      // Set playing state
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsGenerating(false);
      setLoadingStage('');
      
      // Wait for tone to complete
      console.log('Waiting for realign tone to complete...');
      await tonePlayer.waitForCompletion(660000); // 11 minute max
      
      console.log('Realign chakra tone meditation complete');
      if (isPlayingRef.current) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        await stopAllAudio();
        Alert.alert('Session Complete', 'Your chakra realignment meditation has ended. Take a moment to return to awareness.');
      }

    } catch (error) {
      console.error('Error starting realign meditation:', error);
      Alert.alert('Error', 'Failed to start meditation. Please try again.');
      setShowSession(false);
      setIsGenerating(false);
      setLoadingStage('');
    }
  };

  const playVoiceGuidance = async (fullScript: string) => {
    try {
      setIsPlaying(true);
      isPlayingRef.current = true;
      
      // Parse script for pauses
      const pauseRegex = /\[pause(?:\s+for)?\s+(\d+)\s*(?:seconds?|secs?|s)?\s*\]|\[PAUSE\s+(\d+)\s*(?:seconds?|secs?|s)?\s*\]/gi;
      const segments: Array<{type: 'text' | 'pause', content: string, duration?: number}> = [];
      
      let lastIndex = 0;
      let match;
      
      while ((match = pauseRegex.exec(fullScript)) !== null) {
        if (match.index > lastIndex) {
          const textBefore = fullScript.slice(lastIndex, match.index).trim();
          if (textBefore) {
            segments.push({ type: 'text', content: textBefore });
          }
        }
        const duration = parseInt(match[1] || match[2] || '5', 10);
        segments.push({ type: 'pause', content: match[0], duration: Math.min(duration, 30) });
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < fullScript.length) {
        const remaining = fullScript.slice(lastIndex).trim();
        if (remaining) {
          segments.push({ type: 'text', content: remaining });
        }
      }
      
      if (segments.length === 0) {
        segments.push({ type: 'text', content: fullScript });
      }

      console.log('Playing', segments.length, 'segments');

      // Play each segment
      for (let i = 0; i < segments.length; i++) {
        if (!isPlayingRef.current) {
          console.log('Playback stopped by user');
          break;
        }
        
        const segment = segments[i];
        console.log('Segment', i + 1, '/', segments.length, ':', segment.type);
        
        if (segment.type === 'pause') {
          console.log('Pausing for', segment.duration, 'seconds');
          await new Promise(resolve => setTimeout(resolve, (segment.duration || 5) * 1000));
        } else if (segment.type === 'text' && segment.content.trim()) {
          try {
            // Generate TTS for this segment
            console.log('Generating TTS for segment...');
            const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: segment.content,
                voice: 'nova',
              }),
            });
            
            if (!response.ok) {
              console.log('TTS request failed:', response.status);
              continue;
            }
            
            const responseText = await response.text();
            let data;
            try {
              data = JSON.parse(responseText);
            } catch (e) {
              console.log('Failed to parse TTS response');
              continue;
            }
            
            if (!data.audio_base64) {
              console.log('No audio data in response');
              continue;
            }
            
            if (!isPlayingRef.current) break;
            
            // Play voice segment and wait for completion
            console.log('Playing audio segment...');
            const audioUri = `data:audio/mp3;base64,${data.audio_base64}`;
            
            try {
              const player = new AudioPlayerManager();
              await player.loadAndPlay(audioUri, { volume: 1.0 });
              voicePlayerRef.current = player;
              console.log('Audio loaded and playing, waiting for completion...');
              
              // Use the new waitForCompletion method which polls for audio end
              await player.waitForCompletion(180000); // 3 minute max per segment
              console.log('Audio segment finished');
              
              // Clean up the voice player for next segment
              await player.unload();
              voicePlayerRef.current = null;
            } catch (err) {
              console.log('Audio playback error:', err);
            }
            
          } catch (e) {
            console.log('TTS segment error:', e);
          }
        }
      }

      // Meditation complete
      console.log('All segments complete');
      if (isPlayingRef.current) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        await stopAllAudio();
        Alert.alert('Session Complete', 'Your chakra meditation has ended. Take a moment to return to awareness.');
      }

    } catch (error) {
      console.error('Error in voice guidance:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };

  const renderChakraCard = (chakra: Chakra) => (
    <TouchableOpacity
      key={chakra.id}
      style={[styles.chakraCard, { borderLeftColor: chakra.color }]}
      onPress={() => startSingleChakraMeditation(chakra)}
    >
      <View style={[styles.chakraColorDot, { backgroundColor: chakra.color }]} />
      <View style={styles.chakraInfo}>
        <Text style={styles.chakraName}>{chakra.name}</Text>
        <Text style={styles.chakraLocation}>{chakra.location}</Text>
        <Text style={styles.chakraFrequency}>{chakra.frequency} Hz</Text>
      </View>
      <Ionicons name="play-circle" size={32} color={chakra.color} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>Loading chakras...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {showSession ? (isRealignAll ? 'Chakra Realignment' : selectedChakra?.name) : 'Chakra Meditation'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {!showSession ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Realign All Card */}
          <TouchableOpacity
            style={styles.realignCard}
            onPress={startRealignAllMeditation}
          >
            <View style={styles.realignGradient}>
              <View style={styles.chakraRainbow}>
                {chakras.map((c) => (
                  <View key={c.id} style={[styles.rainbowDot, { backgroundColor: c.color }]} />
                ))}
              </View>
              <Text style={styles.realignTitle}>Realign All Chakras</Text>
              <Text style={styles.realignSubtitle}>
                Full journey from Root to Crown with morphing frequencies
              </Text>
              <View style={styles.realignButton}>
                <Ionicons name="infinite" size={24} color="#fff" />
                <Text style={styles.realignButtonText}>Begin Journey</Text>
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Individual Chakras</Text>
          <Text style={styles.sectionSubtitle}>
            Select a chakra to focus on with its specific healing frequency
          </Text>

          {chakras.map(renderChakraCard)}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.sessionContent}>
          {isGenerating ? (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.generatingText}>{loadingStage}</Text>
            </View>
          ) : (
            <>
              {/* Chakra Visualization */}
              <View style={styles.visualization}>
                {isRealignAll ? (
                  <View style={styles.allChakrasVis}>
                    {chakras.map((c) => (
                      <View
                        key={c.id}
                        style={[styles.chakraOrb, { backgroundColor: c.color }]}
                      />
                    ))}
                  </View>
                ) : (
                  <View
                    style={[styles.singleChakraOrb, { backgroundColor: selectedChakra?.color }]}
                  >
                    <Text style={styles.orbFrequency}>{selectedChakra?.frequency} Hz</Text>
                  </View>
                )}
              </View>

              {/* Status */}
              <View style={styles.statusContainer}>
                {isPlaying ? (
                  <>
                    <View style={styles.playingIndicator}>
                      <Ionicons name="volume-high" size={20} color="#10b981" />
                      <Text style={styles.playingText}>
                        {isRealignAll ? 'Playing Chakra Frequency Progression' : `Playing ${selectedChakra?.frequency} Hz Tone`}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.stopButton} onPress={stopAllAudio}>
                      <Ionicons name="stop" size={24} color="#fff" />
                      <Text style={styles.stopText}>Stop</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.completeText}>Session Complete</Text>
                )}
              </View>

              {/* Chakra Info */}
              {selectedChakra && !isRealignAll && (
                <View style={styles.chakraInfoContainer}>
                  <Text style={styles.chakraInfoTitle}>{selectedChakra.name}</Text>
                  <Text style={styles.chakraInfoSanskrit}>{selectedChakra.sanskrit}</Text>
                  <Text style={styles.chakraInfoLocation}>{selectedChakra.location}</Text>
                  <Text style={styles.chakraAffirmation}>"{selectedChakra.affirmation}"</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f0321',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#c4b5fd',
    marginTop: 16,
    fontSize: 16,
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
    padding: 16,
  },
  realignCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  realignGradient: {
    padding: 24,
    backgroundColor: '#1a0033',
    borderWidth: 2,
    borderColor: '#7c3aed',
    borderRadius: 16,
    alignItems: 'center',
  },
  chakraRainbow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rainbowDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  realignTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  realignSubtitle: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 20,
  },
  realignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 8,
  },
  realignButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9f7aea',
    marginBottom: 16,
  },
  chakraCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  chakraColorDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  chakraInfo: {
    flex: 1,
  },
  chakraName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  chakraLocation: {
    fontSize: 13,
    color: '#9f7aea',
    marginTop: 2,
  },
  chakraFrequency: {
    fontSize: 12,
    color: '#c4b5fd',
    marginTop: 2,
  },
  sessionContent: {
    padding: 20,
    alignItems: 'center',
  },
  generatingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  generatingText: {
    color: '#e9d5ff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  visualization: {
    alignItems: 'center',
    marginVertical: 30,
  },
  allChakrasVis: {
    alignItems: 'center',
    gap: 8,
  },
  chakraOrb: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  singleChakraOrb: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbFrequency: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  playingText: {
    color: '#10b981',
    fontSize: 16,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 8,
  },
  stopText: {
    color: '#fff',
    fontWeight: '600',
  },
  completeText: {
    color: '#c4b5fd',
    fontSize: 18,
  },
  chakraInfoContainer: {
    width: '100%',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  chakraInfoTitle: {
    color: '#e9d5ff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  chakraInfoSanskrit: {
    color: '#a855f7',
    fontSize: 16,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  chakraInfoLocation: {
    color: '#9f7aea',
    fontSize: 14,
    marginBottom: 12,
  },
  chakraAffirmation: {
    color: '#c4b5fd',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
