import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { BackgroundImage } from '../../components/BackgroundImage';
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

const DURATION_OPTIONS = [
  { label: '3 min', value: 3 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
];

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
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(5);
  const [pendingChakra, setPendingChakra] = useState<Chakra | null>(null);
  
  const tonePlayerRef = useRef<AudioPlayerManager | null>(null);
  const isPlayingRef = useRef(false);
  
  // Animation refs for chakra visualization
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;
  const ring3Anim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    fetchChakras();
    return () => {
      stopAllAudio();
    };
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Chakra animations effect
  useEffect(() => {
    if (isPlaying) {
      // Start all animations
      // Slow rotation
      const spinAnimation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      
      // Pulsing effect
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      
      // Expanding rings
      const ring1Animation = Animated.loop(
        Animated.timing(ring1Anim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      
      const ring2Animation = Animated.loop(
        Animated.timing(ring2Anim, {
          toValue: 1,
          duration: 3000,
          delay: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      
      const ring3Animation = Animated.loop(
        Animated.timing(ring3Anim, {
          toValue: 1,
          duration: 3000,
          delay: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      
      // Glow animation
      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.5,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      
      spinAnimation.start();
      pulseAnimation.start();
      ring1Animation.start();
      ring2Animation.start();
      ring3Animation.start();
      glowAnimation.start();
      
      return () => {
        spinAnimation.stop();
        pulseAnimation.stop();
        ring1Animation.stop();
        ring2Animation.stop();
        ring3Animation.stop();
        glowAnimation.stop();
        // Reset animations
        spinAnim.setValue(0);
        pulseAnim.setValue(1);
        ring1Anim.setValue(0);
        ring2Anim.setValue(0);
        ring3Anim.setValue(0);
        glowAnim.setValue(0.5);
      };
    }
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
      setChakras([
        { id: 'root', name: 'Root Chakra', sanskrit: 'Muladhara', frequency: 396, color: '#dc2626', location: 'Base of spine', element: 'Earth', benefits: ['Grounding', 'Security'], affirmation: 'I am safe and grounded.' },
        { id: 'sacral', name: 'Sacral Chakra', sanskrit: 'Svadhisthana', frequency: 417, color: '#ea580c', location: 'Lower abdomen', element: 'Water', benefits: ['Creativity', 'Emotions'], affirmation: 'I embrace my creativity and emotions.' },
        { id: 'solar', name: 'Solar Plexus', sanskrit: 'Manipura', frequency: 528, color: '#eab308', location: 'Upper abdomen', element: 'Fire', benefits: ['Confidence', 'Power'], affirmation: 'I am confident and powerful.' },
        { id: 'heart', name: 'Heart Chakra', sanskrit: 'Anahata', frequency: 639, color: '#16a34a', location: 'Center of chest', element: 'Air', benefits: ['Love', 'Compassion'], affirmation: 'I give and receive love freely.' },
        { id: 'throat', name: 'Throat Chakra', sanskrit: 'Vishuddha', frequency: 741, color: '#0ea5e9', location: 'Throat', element: 'Ether', benefits: ['Communication', 'Truth'], affirmation: 'I speak my truth with clarity.' },
        { id: 'third-eye', name: 'Third Eye', sanskrit: 'Ajna', frequency: 852, color: '#6366f1', location: 'Between eyebrows', element: 'Light', benefits: ['Intuition', 'Wisdom'], affirmation: 'I trust my inner wisdom.' },
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
      router.push('/meditation');
    }
  };

  const handleChakraPress = (chakra: Chakra) => {
    setPendingChakra(chakra);
    setShowDurationPicker(true);
  };

  const handleDurationSelect = (duration: number) => {
    setSelectedDuration(duration);
    setShowDurationPicker(false);
    if (pendingChakra) {
      startSingleChakraMeditation(pendingChakra, duration);
      setPendingChakra(null);
    }
  };

  const handleRealignPress = () => {
    setPendingChakra(null);
    setShowDurationPicker(true);
  };

  const handleRealignDurationSelect = (duration: number) => {
    setSelectedDuration(duration);
    setShowDurationPicker(false);
    startRealignAllMeditation(duration);
  };

  const startSingleChakraMeditation = async (chakra: Chakra, durationMinutes: number) => {
    setSelectedChakra(chakra);
    setIsRealignAll(false);
    setIsGenerating(true);
    setShowSession(true);
    setScript(null);

    const durationSeconds = durationMinutes * 60;

    try {
      // Generate meditation script
      setLoadingStage('Generating meditation guide...');
      console.log('Generating script for chakra:', chakra.id);
      const scriptResponse = await fetch(
        `${BACKEND_URL}/api/meditation/chakra/generate-guided/${chakra.id}?duration_minutes=${durationMinutes}`,
        { method: 'POST' }
      );
      
      if (scriptResponse.ok) {
        const scriptData = await scriptResponse.json();
        if (scriptData.script) {
          setScript(scriptData.script);
          console.log('Script generated successfully');
        }
      }

      // Load chakra tone - use streaming URL for native playback
      setLoadingStage('Loading chakra frequency tone...');
      console.log('Loading streaming tone for chakra:', chakra.id);
      
      // Use streaming URL instead of base64 for native audio playback
      const streamingUrl = `${BACKEND_URL}/api/meditation/chakra/stream/${chakra.id}?duration=30`;
      console.log('Streaming URL:', streamingUrl);
      
      // Create and play the tone using streaming URL
      const tonePlayer = new AudioPlayerManager();
      await tonePlayer.loadAndPlay(streamingUrl, { loop: true, volume: 0.8 });
      tonePlayerRef.current = tonePlayer;
      console.log('Tone player loaded and playing from stream');

      // Set playing state
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsGenerating(false);
      setLoadingStage('');
      
      // Don't wait for completion - let user control when to stop
      // The audio loops until stopped

    } catch (error) {
      console.error('Error starting meditation:', error);
      Alert.alert('Error', 'Failed to start meditation. Please try again.');
      setShowSession(false);
      setIsGenerating(false);
      setLoadingStage('');
    }
  };

  const startRealignAllMeditation = async (durationMinutes: number) => {
    setIsRealignAll(true);
    setSelectedChakra(null);
    setIsGenerating(true);
    setShowSession(true);
    setScript(null);

    const durationSeconds = durationMinutes * 60;

    try {
      // Generate realign script
      setLoadingStage('Generating chakra realignment guide...');
      console.log('Generating realign script...');
      const scriptResponse = await fetch(
        `${BACKEND_URL}/api/meditation/chakra/generate-realign?duration_minutes=${durationMinutes}`,
        { method: 'POST' }
      );
      
      if (scriptResponse.ok) {
        const scriptData = await scriptResponse.json();
        if (scriptData.script) {
          setScript(scriptData.script);
          console.log('Realign script generated successfully');
        }
      }

      // Load morphing chakra tone - use streaming URL for native playback
      setLoadingStage('Loading chakra frequency progression...');
      console.log('Loading realign tone stream...');
      
      // Use streaming URL instead of base64
      const streamingUrl = `${BACKEND_URL}/api/meditation/chakra/stream-realign?duration=60`;
      console.log('Realign streaming URL:', streamingUrl);
      
      // Create and play the tone using streaming URL
      const tonePlayer = new AudioPlayerManager();
      await tonePlayer.loadAndPlay(streamingUrl, { loop: true, volume: 0.8 });
      tonePlayerRef.current = tonePlayer;
      console.log('Realign tone player loaded and playing from stream');

      // Set playing state
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsGenerating(false);
      setLoadingStage('');
      
      // Don't wait for completion - let user control when to stop
      // The audio loops until stopped

    } catch (error) {
      console.error('Error starting realign meditation:', error);
      Alert.alert('Error', 'Failed to start meditation. Please try again.');
      setShowSession(false);
      setIsGenerating(false);
      setLoadingStage('');
    }
  };

  const renderChakraCard = (chakra: Chakra) => (
    <TouchableOpacity
      key={chakra.id}
      style={[styles.chakraCard, { borderLeftColor: chakra.color }]}
      onPress={() => handleChakraPress(chakra)}
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
    <BackgroundImage 
      source={require('../../assets/backgrounds/chakra-bg.png')}
      opacity={0.3}
      overlayColor="rgba(15, 3, 33, 0.7)"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {showSession ? (isRealignAll ? 'Chakra Realignment' : selectedChakra?.name) : 'Chakra Meditations'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Duration Picker Modal */}
      <Modal
        visible={showDurationPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDurationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Duration</Text>
            <Text style={styles.modalSubtitle}>
              {pendingChakra ? `${pendingChakra.name} - ${pendingChakra.frequency} Hz` : 'Full Chakra Realignment'}
            </Text>
            <View style={styles.durationGrid}>
              {DURATION_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.durationButton,
                    { borderColor: pendingChakra?.color || '#a855f7' }
                  ]}
                  onPress={() => pendingChakra ? handleDurationSelect(option.value) : handleRealignDurationSelect(option.value)}
                >
                  <Text style={styles.durationText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowDurationPicker(false);
                setPendingChakra(null);
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {!showSession ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Realign All Card */}
          <TouchableOpacity
            style={styles.realignCard}
            onPress={handleRealignPress}
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
              {/* Animated Chakra Visualization */}
              <View style={styles.visualization}>
                {isRealignAll ? (
                  <View style={styles.allChakrasVis}>
                    {chakras.map((c, index) => (
                      <Animated.View
                        key={c.id}
                        style={[
                          styles.chakraOrb, 
                          { 
                            backgroundColor: c.color,
                            transform: [
                              { scale: pulseAnim },
                            ],
                            opacity: glowAnim,
                          }
                        ]}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.animatedChakraContainer}>
                    {/* Expanding energy rings */}
                    <Animated.View
                      style={[
                        styles.energyRing,
                        {
                          borderColor: selectedChakra?.color,
                          transform: [
                            { scale: ring1Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 2.5],
                            })},
                          ],
                          opacity: ring1Anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.6, 0],
                          }),
                        }
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.energyRing,
                        {
                          borderColor: selectedChakra?.color,
                          transform: [
                            { scale: ring2Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 2.5],
                            })},
                          ],
                          opacity: ring2Anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.6, 0],
                          }),
                        }
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.energyRing,
                        {
                          borderColor: selectedChakra?.color,
                          transform: [
                            { scale: ring3Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 2.5],
                            })},
                          ],
                          opacity: ring3Anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.6, 0],
                          }),
                        }
                      ]}
                    />
                    
                    {/* Outer glow */}
                    <Animated.View
                      style={[
                        styles.outerGlow,
                        { 
                          backgroundColor: selectedChakra?.color,
                          opacity: glowAnim.interpolate({
                            inputRange: [0.5, 1],
                            outputRange: [0.15, 0.3],
                          }),
                          transform: [{ scale: pulseAnim }],
                        }
                      ]}
                    />
                    
                    {/* Main chakra orb with rotation */}
                    <Animated.View
                      style={[
                        styles.singleChakraOrb, 
                        { 
                          backgroundColor: selectedChakra?.color,
                          transform: [
                            { scale: pulseAnim },
                            { rotate: spinAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            })},
                          ],
                        }
                      ]}
                    >
                      {/* Chakra symbol pattern */}
                      <View style={styles.chakraSymbol}>
                        <View style={[styles.symbolLine, styles.symbolLineHorizontal]} />
                        <View style={[styles.symbolLine, styles.symbolLineVertical]} />
                        <View style={[styles.symbolLine, styles.symbolLineDiag1]} />
                        <View style={[styles.symbolLine, styles.symbolLineDiag2]} />
                      </View>
                      <Text style={styles.orbFrequency}>{selectedChakra?.frequency} Hz</Text>
                    </Animated.View>
                  </View>
                )}
              </View>

              {/* Status and Controls */}
              <View style={styles.statusContainer}>
                {isPlaying ? (
                  <>
                    <View style={styles.playingIndicator}>
                      <Ionicons name="musical-notes" size={20} color="#10b981" />
                      <Text style={styles.playingText}>
                        {isRealignAll 
                          ? `Playing Frequency Progression (${selectedDuration} min)` 
                          : `Playing ${selectedChakra?.frequency} Hz (${selectedDuration} min)`}
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

              {/* Written Meditation Guide */}
              {script && (
                <View style={styles.scriptContainer}>
                  <Text style={styles.scriptTitle}>
                    <Ionicons name="book-outline" size={18} color="#a855f7" /> Meditation Guide
                  </Text>
                  <ScrollView style={styles.scriptScroll} nestedScrollEnabled>
                    <Text style={styles.scriptText}>{script}</Text>
                  </ScrollView>
                </View>
              )}

              {/* Chakra Info */}
              {selectedChakra && !isRealignAll && (
                <View style={[styles.chakraInfoContainer, { borderColor: selectedChakra.color }]}>
                  <Text style={styles.chakraInfoTitle}>{selectedChakra.name}</Text>
                  <Text style={styles.chakraInfoSanskrit}>{selectedChakra.sanskrit}</Text>
                  <Text style={styles.chakraInfoLocation}>{selectedChakra.location} • {selectedChakra.element}</Text>
                  <Text style={styles.chakraAffirmation}>"{selectedChakra.affirmation}"</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
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
    padding: 16,
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
    paddingHorizontal: 16,
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
    padding: 12,
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
    marginVertical: 20,
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
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbFrequency: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  playingText: {
    color: '#10b981',
    fontSize: 15,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  scriptContainer: {
    width: '100%',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    maxHeight: 280,
  },
  scriptTitle: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  scriptScroll: {
    maxHeight: 220,
  },
  scriptText: {
    color: '#c4b5fd',
    fontSize: 14,
    lineHeight: 22,
  },
  chakraInfoContainer: {
    width: '100%',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
  },
  chakraInfoTitle: {
    color: '#e9d5ff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  chakraInfoSanskrit: {
    color: '#a855f7',
    fontSize: 15,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  chakraInfoLocation: {
    color: '#9f7aea',
    fontSize: 13,
    marginBottom: 10,
  },
  chakraAffirmation: {
    color: '#c4b5fd',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 16,
    width: '85%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#c4b5fd',
    marginBottom: 20,
    textAlign: 'center',
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  durationButton: {
    width: '45%',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: '#0f0321',
  },
  durationText: {
    color: '#e9d5ff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  cancelText: {
    color: '#9f7aea',
    fontSize: 16,
  },
  // Animation styles
  animatedChakraContainer: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  outerGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  chakraSymbol: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  symbolLineHorizontal: {
    width: '80%',
    height: 2,
  },
  symbolLineVertical: {
    width: 2,
    height: '80%',
  },
  symbolLineDiag1: {
    width: 2,
    height: '80%',
    transform: [{ rotate: '45deg' }],
  },
  symbolLineDiag2: {
    width: 2,
    height: '80%',
    transform: [{ rotate: '-45deg' }],
  },
});
