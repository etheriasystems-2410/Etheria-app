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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { Paywall } from '../components/Paywall';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface CardReading {
  card: {
    name: string;
    element: string;
    description: string;
    image_url: string;
  };
  position?: string;
  interpretation: string;
}

interface Reading {
  spread_type: string;
  cards: CardReading[];
  overall_interpretation?: string;
  timestamp: string;
}

interface SpreadType {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  positions: string[];
  free: boolean;
  icon: string;
  image: string;
}

const SPREAD_TYPES: SpreadType[] = [
  {
    id: 'single',
    name: 'Single Card',
    description: 'Quick guidance for a simple question',
    cardCount: 1,
    positions: ['Guidance'],
    free: true,
    icon: 'sparkles',
    image: 'https://images.unsplash.com/photo-1601662528567-526cd06f6582?w=200&h=300&fit=crop',
  },
  {
    id: 'three-card',
    name: 'Three Card Spread',
    description: 'Past, Present, and Future insights',
    cardCount: 3,
    positions: ['Past', 'Present', 'Future'],
    free: false,
    icon: 'time',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=300&fit=crop',
  },
  {
    id: 'relationship',
    name: 'Relationship Spread',
    description: 'You, Partner, and Connection dynamics',
    cardCount: 3,
    positions: ['You', 'Partner', 'Connection'],
    free: false,
    icon: 'heart',
    image: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=200&h=300&fit=crop',
  },
  {
    id: 'celtic-cross',
    name: 'Celtic Cross',
    description: 'Deep dive into your situation',
    cardCount: 6,
    positions: ['Present', 'Challenge', 'Past', 'Future', 'Above', 'Below'],
    free: false,
    icon: 'compass',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&h=300&fit=crop',
  },
  {
    id: 'spiritual-path',
    name: 'Spiritual Path',
    description: 'Guidance for your spiritual journey',
    cardCount: 5,
    positions: ['Current State', 'Obstacle', 'Hidden Influence', 'Guidance', 'Outcome'],
    free: false,
    icon: 'planet',
    image: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=200&h=300&fit=crop',
  },
];

export default function Oracle() {
  const { isPremium } = useAuth();
  const [selectedSpread, setSelectedSpread] = useState<SpreadType | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentReading, setCurrentReading] = useState<Reading | null>(null);
  const [showReading, setShowReading] = useState(false);
  const [savedReadings, setSavedReadings] = useState<Reading[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  
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

  const handleSpreadSelect = (spread: SpreadType) => {
    if (spread.free || isPremium) {
      setSelectedSpread(spread);
    } else {
      setShowPaywall(true);
    }
  };

  const drawCards = async () => {
    if (!selectedSpread) return;
    
    setLoading(true);
    setCurrentCardIndex(0);
    
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spread_type: selectedSpread.id,
          card_count: selectedSpread.cardCount,
          positions: selectedSpread.positions,
        }),
      });
      
      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        Alert.alert('Error', 'Failed to draw cards. Please try again.');
        return;
      }
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON parse error:', text);
        Alert.alert('Error', 'Failed to process reading. Please try again.');
        return;
      }
      
      // Transform single card response to new format if needed
      const reading: Reading = data.cards ? data : {
        spread_type: selectedSpread.id,
        cards: [{
          card: data.card,
          position: selectedSpread.positions[0],
          interpretation: data.interpretation,
        }],
        timestamp: data.timestamp,
      };
      
      setCurrentReading(reading);
      
      // Card flip animation
      cardFlipAnim.setValue(0);
      setShowReading(true);
      Animated.timing(cardFlipAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Error drawing cards:', error);
      Alert.alert('Connection Error', 'Unable to connect to the server. Please check your connection and try again.');
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
      setSelectedSpread(null);
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

  const playInterpretation = async (text: string, guideName: string) => {
    setAudioLoading(true);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          guide_name: guideName,
        }),
      });

      const data = await response.json();
      
      if (!data.success || !data.audio_base64) {
        console.log('TTS unavailable');
        return;
      }

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
      case 'fire': return '#ef4444';
      case 'water': return '#3b82f6';
      case 'earth': return '#10b981';
      case 'air': return '#a855f7';
      default: return '#8b5cf6';
    }
  };

  const cardRotateY = cardFlipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Spread Selection View
  if (!selectedSpread) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Ionicons name="sparkles" size={60} color="#b794f6" />
            <Text style={styles.title}>Oracle Divination</Text>
            <Text style={styles.subtitle}>Choose your card spread</Text>
          </View>

          <View style={styles.spreadsContainer}>
            {SPREAD_TYPES.map((spread) => {
              const isLocked = !spread.free && !isPremium;
              return (
                <TouchableOpacity
                  key={spread.id}
                  style={[styles.spreadCard, isLocked && styles.lockedSpreadCard]}
                  onPress={() => handleSpreadSelect(spread)}
                  activeOpacity={0.7}
                >
                  <View style={styles.spreadCardRow}>
                    {/* Thumbnail Image */}
                    <View style={styles.spreadThumbnailContainer}>
                      <Image
                        source={{ uri: spread.image }}
                        style={[styles.spreadThumbnail, isLocked && styles.lockedThumbnail]}
                        contentFit="cover"
                      />
                      {isLocked && (
                        <View style={styles.thumbnailLockOverlay}>
                          <Ionicons name="lock-closed" size={20} color="#ffd700" />
                        </View>
                      )}
                      <View style={styles.cardCountOverlay}>
                        <Text style={styles.cardCountOverlayText}>{spread.cardCount}</Text>
                      </View>
                    </View>

                    {/* Content */}
                    <View style={styles.spreadContent}>
                      <View style={styles.spreadBadges}>
                        {spread.free ? (
                          <View style={styles.freeBadge}>
                            <Text style={styles.freeBadgeText}>FREE</Text>
                          </View>
                        ) : (
                          <View style={styles.premiumBadge}>
                            <Ionicons name="diamond" size={10} color="#ffd700" />
                            <Text style={styles.premiumBadgeText}>Premium</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.spreadName, isLocked && styles.lockedText]}>{spread.name}</Text>
                      <Text style={[styles.spreadDescription, isLocked && styles.lockedText]} numberOfLines={2}>{spread.description}</Text>
                      <View style={styles.spreadMeta}>
                        <Ionicons name={spread.icon as any} size={14} color={isLocked ? '#6b5b8a' : '#b794f6'} />
                        <Text style={[styles.spreadMetaText, isLocked && styles.lockedText]}>
                          {spread.cardCount} card{spread.cardCount > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Arrow */}
                    <View style={styles.spreadArrow}>
                      {isLocked ? (
                        <Ionicons name="lock-closed" size={18} color="#ffd700" />
                      ) : (
                        <Ionicons name="chevron-forward" size={22} color="#b794f6" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.historyButton} onPress={loadHistory} activeOpacity={0.7}>
            <Ionicons name="time" size={20} color="#c4b5fd" />
            <Text style={styles.historyButtonText}>View Past Readings</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Paywall Modal */}
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="Premium Card Spreads"
        />

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
                      <View style={styles.historyCardContent}>
                        <Text style={styles.historySpreadType}>
                          {SPREAD_TYPES.find(s => s.id === reading.spread_type)?.name || 'Reading'}
                        </Text>
                        <Text style={styles.historyCardCount}>
                          {reading.cards?.length || 1} card{(reading.cards?.length || 1) > 1 ? 's' : ''}
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

  // Card Drawing View
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.backButton} onPress={() => setSelectedSpread(null)}>
          <Ionicons name="arrow-back" size={24} color="#b794f6" />
          <Text style={styles.backButtonText}>Back to Spreads</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Ionicons name={selectedSpread.icon as any} size={50} color="#b794f6" />
          <Text style={styles.title}>{selectedSpread.name}</Text>
          <Text style={styles.subtitle}>{selectedSpread.description}</Text>
        </View>

        <View style={styles.positionsPreview}>
          {selectedSpread.positions.map((position, index) => (
            <View key={index} style={styles.positionItem}>
              <View style={styles.positionNumber}>
                <Text style={styles.positionNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.positionName}>{position}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardContainer}>
          <Animated.View
            style={[
              styles.cardWrapper,
              { transform: [{ scale: cardScaleAnim }] },
            ]}
          >
            <View style={styles.cardBack}>
              <View style={styles.cardBackPattern}>
                <Ionicons name="moon" size={80} color="#b794f6" />
                <Text style={styles.cardBackText}>Oracle Cards</Text>
                <Text style={styles.cardBackSubtext}>{selectedSpread.cardCount} Card{selectedSpread.cardCount > 1 ? 's' : ''}</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        <TouchableOpacity
          style={[styles.drawButton, loading && styles.drawButtonDisabled]}
          onPress={drawCards}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="hand-left" size={24} color="#fff" />
              <Text style={styles.drawButtonText}>Draw {selectedSpread.cardCount} Card{selectedSpread.cardCount > 1 ? 's' : ''}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.instructionCard}>
          <Text style={styles.instructionText}>
            🌙 Close your eyes and focus on your question{'\n'}
            ✨ When ready, tap to draw your cards{'\n'}
            🔮 Trust the guidance you receive
          </Text>
        </View>
      </ScrollView>

      {/* Reading Modal */}
      <Modal visible={showReading} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              {currentReading && currentReading.cards && (
                <>
                  {/* Card Navigation for multi-card spreads */}
                  {currentReading.cards.length > 1 && (
                    <View style={styles.cardNavigation}>
                      {currentReading.cards.map((_, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.cardNavDot,
                            currentCardIndex === index && styles.cardNavDotActive,
                          ]}
                          onPress={() => setCurrentCardIndex(index)}
                        >
                          <Text style={styles.cardNavNumber}>{index + 1}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Current Card Display */}
                  {currentReading.cards[currentCardIndex] && (
                    <>
                      <View style={styles.positionLabel}>
                        <Text style={styles.positionLabelText}>
                          {currentReading.cards[currentCardIndex].position}
                        </Text>
                      </View>

                      <Animated.View
                        style={[
                          styles.cardImageContainer,
                          { transform: [{ rotateY: cardRotateY }] },
                        ]}
                      >
                        <Image
                          source={{ uri: currentReading.cards[currentCardIndex].card.image_url }}
                          style={styles.cardImage}
                          contentFit="cover"
                          transition={300}
                        />
                        <View style={styles.cardImageOverlay}>
                          <View
                            style={[
                              styles.elementBadge,
                              { backgroundColor: getElementColor(currentReading.cards[currentCardIndex].card.element) },
                            ]}
                          >
                            <Text style={styles.elementText}>{currentReading.cards[currentCardIndex].card.element}</Text>
                          </View>
                        </View>
                      </Animated.View>

                      <Text style={styles.cardName}>{currentReading.cards[currentCardIndex].card.name}</Text>
                      <Text style={styles.cardDescription}>{currentReading.cards[currentCardIndex].card.description}</Text>

                      <View style={styles.divider} />

                      <View style={styles.interpretationSection}>
                        <View style={styles.interpretationHeader}>
                          <Ionicons name="book" size={24} color="#b794f6" />
                          <Text style={styles.interpretationTitle}>Interpretation</Text>
                        </View>
                        <Text style={styles.interpretation}>{currentReading.cards[currentCardIndex].interpretation}</Text>
                        
                        <View style={styles.audioControlsSection}>
                          <Text style={styles.audioLabel}>Listen to interpretation:</Text>
                          <View style={styles.audioButtons}>
                            {['Aether', 'Ignis'].map((guideName) => (
                              <TouchableOpacity
                                key={guideName}
                                style={[
                                  styles.guideAudioButton,
                                  isPlayingAudio && styles.guideAudioButtonDisabled,
                                ]}
                                onPress={() => playInterpretation(currentReading.cards[currentCardIndex].interpretation, guideName)}
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

                      {/* Card Navigation Arrows */}
                      {currentReading.cards.length > 1 && (
                        <View style={styles.cardNavigationSection}>
                          <View style={styles.cardArrows}>
                            <TouchableOpacity
                              style={[styles.arrowButton, currentCardIndex === 0 && styles.arrowButtonDisabled]}
                              onPress={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                              disabled={currentCardIndex === 0}
                            >
                              <Ionicons name="chevron-back" size={24} color={currentCardIndex === 0 ? '#4a3b6e' : '#b794f6'} />
                              <Text style={[styles.arrowText, currentCardIndex === 0 && styles.arrowTextDisabled]}>Previous</Text>
                            </TouchableOpacity>
                            <Text style={styles.cardCounter}>
                              Card {currentCardIndex + 1} of {currentReading.cards.length}
                            </Text>
                            <TouchableOpacity
                              style={[styles.arrowButton, currentCardIndex === currentReading.cards.length - 1 && styles.arrowButtonDisabled]}
                              onPress={() => setCurrentCardIndex(Math.min(currentReading.cards.length - 1, currentCardIndex + 1))}
                              disabled={currentCardIndex === currentReading.cards.length - 1}
                            >
                              <Text style={[styles.arrowText, currentCardIndex === currentReading.cards.length - 1 && styles.arrowTextDisabled]}>Next</Text>
                              <Ionicons name="chevron-forward" size={24} color={currentCardIndex === currentReading.cards.length - 1 ? '#4a3b6e' : '#b794f6'} />
                            </TouchableOpacity>
                          </View>
                          
                          {/* Prominent Next Card Button */}
                          {currentCardIndex < currentReading.cards.length - 1 && (
                            <TouchableOpacity
                              style={styles.nextCardButton}
                              onPress={() => setCurrentCardIndex(currentCardIndex + 1)}
                            >
                              <Text style={styles.nextCardButtonText}>
                                Next: {currentReading.cards[currentCardIndex + 1].position}
                              </Text>
                              <Ionicons name="arrow-forward" size={20} color="#1a0033" />
                            </TouchableOpacity>
                          )}
                          
                          {/* Show "Complete Reading" when on last card */}
                          {currentCardIndex === currentReading.cards.length - 1 && (
                            <View style={styles.readingCompleteBox}>
                              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                              <Text style={styles.readingCompleteText}>Reading Complete</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
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
                    setSelectedSpread(null);
                    setCurrentCardIndex(0);
                  }}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    color: '#b794f6',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
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
  spreadsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  spreadCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  lockedSpreadCard: {
    opacity: 0.9,
  },
  spreadCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spreadThumbnailContainer: {
    position: 'relative',
    width: 80,
    height: 100,
  },
  spreadThumbnail: {
    width: '100%',
    height: '100%',
  },
  lockedThumbnail: {
    opacity: 0.6,
  },
  thumbnailLockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCountOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.9)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCountOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  spreadContent: {
    flex: 1,
    padding: 12,
    paddingLeft: 14,
  },
  spreadBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  freeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  freeBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  premiumBadgeText: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  spreadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 2,
  },
  spreadDescription: {
    fontSize: 12,
    color: '#c4b5fd',
    marginBottom: 6,
  },
  lockedText: {
    color: '#8b7ba0',
  },
  spreadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spreadMetaText: {
    fontSize: 11,
    color: '#b794f6',
  },
  spreadArrow: {
    paddingRight: 16,
  },
  positionsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  positionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  positionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  positionName: {
    color: '#c4b5fd',
    fontSize: 13,
  },
  cardContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  cardWrapper: {
    width: width * 0.6,
    aspectRatio: 2 / 3,
    maxWidth: 240,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 12,
  },
  cardBackSubtext: {
    fontSize: 14,
    color: '#c4b5fd',
    marginTop: 4,
  },
  drawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
    minWidth: 200,
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
    justifyContent: 'center',
    marginTop: 20,
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
  cardNavigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  cardNavDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2d1b4e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardNavDotActive: {
    backgroundColor: '#7c3aed',
  },
  cardNavNumber: {
    color: '#e9d5ff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  positionLabel: {
    alignSelf: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  positionLabelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  cardNavigationSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
  },
  cardArrows: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
  },
  arrowButtonDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    color: '#b794f6',
    fontSize: 14,
    fontWeight: '600',
  },
  arrowTextDisabled: {
    color: '#4a3b6e',
  },
  cardCounter: {
    color: '#c4b5fd',
    fontSize: 14,
  },
  nextCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b794f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginTop: 16,
    gap: 10,
  },
  nextCardButtonText: {
    color: '#1a0033',
    fontSize: 18,
    fontWeight: 'bold',
  },
  readingCompleteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  readingCompleteText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#2d1b4e',
    borderRadius: 16,
    margin: 12,
    padding: 16,
  },
  historyCardContent: {
    gap: 4,
  },
  historySpreadType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  historyCardCount: {
    fontSize: 14,
    color: '#b794f6',
  },
  historyDate: {
    fontSize: 12,
    color: '#9f7aea',
    marginTop: 4,
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
