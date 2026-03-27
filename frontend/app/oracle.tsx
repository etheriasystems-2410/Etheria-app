import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface Reading {
  card: {
    name: string;
    element: string;
    description: string;
    image_url: string;
  };
  interpretation: string;
  timestamp: string;
}

export default function Oracle() {
  const [loading, setLoading] = useState(false);
  const [currentReading, setCurrentReading] = useState<Reading | null>(null);
  const [showReading, setShowReading] = useState(false);
  const [savedReadings, setSavedReadings] = useState<Reading[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  
  const cardFlipAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const drawCard = async () => {
    setLoading(true);
    
    // Card shuffle animation
    Animated.sequence([
      Animated.timing(cardScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const response = await fetch(`${BACKEND_URL}/api/oracle/draw`, {
        method: 'POST',
      });
      const data = await response.json();
      setCurrentReading(data);
      
      // Card flip animation
      cardFlipAnim.setValue(0);
      setShowReading(true);
      Animated.timing(cardFlipAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Error drawing card:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveReading = async () => {
    if (!currentReading) return;
    try {
      await fetch(`${BACKEND_URL}/api/oracle/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentReading),
      });
      setSavedReadings([currentReading, ...savedReadings]);
      setShowReading(false);
      setCurrentReading(null);
    } catch (error) {
      console.error('Error saving reading:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/oracle/readings`);
      const data = await response.json();
      setSavedReadings(data);
      setShowHistory(true);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const playInterpretation = async (guideName: string) => {
    if (!currentReading) return;
    
    setAudioLoading(true);
    try {
      // Stop any currently playing audio
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentReading.interpretation,
          guide_name: guideName,
        }),
      });

      const data = await response.json();

      // Play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${data.audio_base64}` },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setIsPlayingAudio(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingAudio(false);
        }
      });
    } catch (error) {
      console.error('Error playing interpretation:', error);
    } finally {
      setAudioLoading(false);
    }
  };

  const stopAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlayingAudio(false);
    }
  };

  const getElementColor = (element: string) => {
    switch (element.toLowerCase()) {
      case 'fire':
        return '#ef4444';
      case 'water':
        return '#3b82f6';
      case 'earth':
        return '#10b981';
      case 'air':
        return '#a855f7';
      default:
        return '#8b5cf6';
    }
  };

  const cardRotateY = cardFlipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={60} color="#b794f6" />
          <Text style={styles.title}>Oracle Divination</Text>
          <Text style={styles.subtitle}>Seek wisdom from the spirit guides</Text>
        </View>

        <View style={styles.cardContainer}>
          <Animated.View
            style={[
              styles.cardWrapper,
              {
                transform: [{ scale: cardScaleAnim }],
              },
            ]}
          >
            <View style={styles.cardBack}>
              <View style={styles.cardBackPattern}>
                <Ionicons name="moon" size={80} color="#b794f6" />
                <Text style={styles.cardBackText}>Oracle Cards</Text>
                <Text style={styles.cardBackSubtext}>Spirit Guide Wisdom</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        <TouchableOpacity
          style={[styles.drawButton, loading && styles.drawButtonDisabled]}
          onPress={drawCard}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="hand-left" size={24} color="#fff" />
              <Text style={styles.drawButtonText}>Draw a Card</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.historyButton} onPress={loadHistory} activeOpacity={0.7}>
          <Ionicons name="time" size={20} color="#c4b5fd" />
          <Text style={styles.historyButtonText}>View Past Readings</Text>
        </TouchableOpacity>

        <View style={styles.instructionCard}>
          <Text style={styles.instructionText}>
            🌙 Close your eyes and focus on your question{'\n'}
            ✨ When ready, tap "Draw a Card"{'\n'}
            🔮 Trust the guidance you receive
          </Text>
        </View>
      </ScrollView>

      {/* Reading Modal */}
      <Modal visible={showReading} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              {currentReading && (
                <>
                  <Animated.View
                    style={[
                      styles.cardImageContainer,
                      {
                        transform: [{ rotateY: cardRotateY }],
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: currentReading.card.image_url }}
                      style={styles.cardImage}
                      contentFit="cover"
                      transition={300}
                    />
                    <View style={styles.cardImageOverlay}>
                      <View
                        style={[
                          styles.elementBadge,
                          { backgroundColor: getElementColor(currentReading.card.element) },
                        ]}
                      >
                        <Text style={styles.elementText}>{currentReading.card.element}</Text>
                      </View>
                    </View>
                  </Animated.View>

                  <Text style={styles.cardName}>{currentReading.card.name}</Text>
                  <Text style={styles.cardDescription}>{currentReading.card.description}</Text>

                  <View style={styles.divider} />

                  <View style={styles.interpretationSection}>
                    <View style={styles.interpretationHeader}>
                      <Ionicons name="book" size={24} color="#b794f6" />
                      <Text style={styles.interpretationTitle}>Interpretation</Text>
                    </View>
                    <Text style={styles.interpretation}>{currentReading.interpretation}</Text>
                    
                    <View style={styles.audioControlsSection}>
                      <Text style={styles.audioLabel}>Listen to interpretation:</Text>
                      <View style={styles.audioButtons}>
                        {['Ignis', 'Aqua', 'Terra', 'Aether'].map((guideName) => (
                          <TouchableOpacity
                            key={guideName}
                            style={[
                              styles.guideAudioButton,
                              isPlayingAudio && styles.guideAudioButtonDisabled,
                            ]}
                            onPress={() => playInterpretation(guideName)}
                            disabled={isPlayingAudio || audioLoading}
                          >
                            {audioLoading ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons name="volume-high" size={16} color="#fff" />
                                <Text style={styles.guideAudioButtonText}>{guideName}</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                      {isPlayingAudio && (
                        <TouchableOpacity style={styles.stopAudioButton} onPress={stopAudio}>
                          <Ionicons name="stop-circle" size={20} color="#ef4444" />
                          <Text style={styles.stopAudioText}>Stop</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveReading}
                >
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={styles.modalButtonText}>Save Reading</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.closeButton]}
                  onPress={() => {
                    setShowReading(false);
                    setCurrentReading(null);
                  }}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.historyModal}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Past Readings</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={28} color="#e9d5ff" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {savedReadings.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Ionicons name="sparkles-outline" size={60} color="#9f7aea" />
                  <Text style={styles.emptyText}>No saved readings yet</Text>
                </View>
              ) : (
                savedReadings.map((reading, index) => (
                  <View key={index} style={styles.historyCard}>
                    <Image
                      source={{ uri: reading.card.image_url }}
                      style={styles.historyCardImage}
                      contentFit="cover"
                    />
                    <View style={styles.historyCardContent}>
                      <View
                        style={[
                          styles.historyElementBadge,
                          { backgroundColor: getElementColor(reading.card.element) },
                        ]}
                      >
                        <Text style={styles.historyElementText}>{reading.card.element}</Text>
                      </View>
                      <Text style={styles.historyCardName}>{reading.card.name}</Text>
                      <Text style={styles.historyCardDescription} numberOfLines={2}>
                        {reading.card.description}
                      </Text>
                      <Text style={styles.historyDate}>
                        {new Date(reading.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#c4b5fd',
    marginTop: 8,
    textAlign: 'center',
  },
  cardContainer: {
    marginBottom: 40,
  },
  cardWrapper: {
    width: width * 0.7,
    aspectRatio: 2 / 3,
    maxWidth: 280,
  },
  cardBack: {
    flex: 1,
    backgroundColor: '#1a0033',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#b794f6',
    overflow: 'hidden',
  },
  cardBackPattern: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d1b4e',
  },
  cardBackText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 16,
  },
  cardBackSubtext: {
    fontSize: 14,
    color: '#c4b5fd',
    marginTop: 8,
  },
  drawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
    minWidth: 180,
    justifyContent: 'center',
  },
  drawButtonDisabled: {
    opacity: 0.6,
  },
  drawButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  historyButtonText: {
    color: '#c4b5fd',
    fontSize: 16,
  },
  instructionCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  instructionText: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 24,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
  },
  modalScrollContent: {
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a0033',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  cardImageContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  elementBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  elementText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#2d1b4e',
    marginVertical: 20,
  },
  interpretationSection: {
    marginBottom: 20,
  },
  interpretationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  interpretationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#b794f6',
  },
  interpretation: {
    fontSize: 16,
    color: '#e9d5ff',
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#7c3aed',
  },
  closeButton: {
    backgroundColor: '#2d1b4e',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyModal: {
    flex: 1,
    backgroundColor: '#1a0033',
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#c4b5fd',
    marginTop: 16,
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#2d1b4e',
    borderRadius: 16,
    margin: 12,
    overflow: 'hidden',
  },
  historyCardImage: {
    width: 100,
    height: 150,
  },
  historyCardContent: {
    flex: 1,
    padding: 12,
  },
  historyElementBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  historyElementText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  historyCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 6,
  },
  historyCardDescription: {
    fontSize: 13,
    color: '#c4b5fd',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 12,
    color: '#9f7aea',
  },
  audioControlsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c4b5fd',
    marginBottom: 12,
  },
  audioButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  guideAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  guideAudioButtonDisabled: {
    opacity: 0.5,
  },
  guideAudioButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  stopAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    gap: 6,
  },
  stopAudioText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
});
