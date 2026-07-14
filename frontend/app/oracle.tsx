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
  Image as RNImage,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import HeaderBanner from '../components/HeaderBanner';
import { Paywall } from '../components/Paywall';
import SubscriptionOnlyBanner from '../components/SubscriptionOnlyBanner';
import { Mist } from '../components/ui';
import { palette, radii, spacing } from '../theme/tokens';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');
const ORACLE_HERO_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/qnwv0w54_36736.jpg';

interface CardReading {
  card: {
    name: string;
    element: string;
    description: string;
    image_url?: string;
    image_base64?: string;
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
  image: any;
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
    image: require('../assets/images/oracle-one-card.jpg'),
  },
  {
    id: 'three-card',
    name: 'Three Card Spread',
    description: 'Past, Present, and Future insights',
    cardCount: 3,
    positions: ['Past', 'Present', 'Future'],
    free: false,
    icon: 'time',
    image: require('../assets/images/oracle-three-card.jpg'),
  },
  {
    id: 'relationship',
    name: 'Relationship Spread',
    description: 'You, Partner, and Connection dynamics',
    cardCount: 3,
    positions: ['You', 'Partner', 'Connection'],
    free: false,
    icon: 'heart',
    image: require('../assets/images/oracle-relationship.jpg'),
  },
  {
    id: 'celtic-cross',
    name: 'Celtic Cross',
    description: 'Deep dive into your situation',
    cardCount: 6,
    positions: ['Present', 'Challenge', 'Past', 'Future', 'Above', 'Below'],
    free: false,
    icon: 'compass',
    image: require('../assets/images/oracle-guidance.jpg'),
  },
  {
    id: 'spiritual-path',
    name: 'Spiritual Path',
    description: 'Guidance for your spiritual journey',
    cardCount: 5,
    positions: ['Current State', 'Obstacle', 'Hidden Influence', 'Guidance', 'Outcome'],
    free: false,
    icon: 'planet',
    image: require('../assets/images/oracle-spiritual.jpg'),
  },
];

export default function Oracle() {
  const { isPremium } = useAuth();
  const { t, languageCode } = useLanguage();
  const { theme } = useTheme();
  const [selectedSpread, setSelectedSpread] = useState<SpreadType | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentReading, setCurrentReading] = useState<Reading | null>(null);
  const [showReading, setShowReading] = useState(false);
  const [savedReadings, setSavedReadings] = useState<Reading[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showJournalPrompt, setShowJournalPrompt] = useState(false);
  const [readingQuestion, setReadingQuestion] = useState('');

  // ---- Quantum AI follow-up chat ----
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = React.useRef<ScrollView | null>(null);

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q || chatSending || !currentReading) return;
    const nextMessages = [...chatMessages, { role: 'user' as const, text: q }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatSending(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      const r = await fetch(`${backendUrl}/api/oracle/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reading: {
            spread_type: currentReading.spread_type,
            cards: currentReading.cards.map((c) => ({
              position: c.position,
              card: {
                name: c.card.name,
                element: c.card.element,
                description: c.card.description,
              },
              interpretation: c.interpretation,
            })),
            overall_interpretation: currentReading.overall_interpretation || '',
          },
          history: chatMessages,
          question: q,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setChatMessages([
          ...nextMessages,
          {
            role: 'assistant',
            text:
              data?.detail ||
              'Quantum is momentarily out of reach. Please try again.',
          },
        ]);
      } else {
        setChatMessages([
          ...nextMessages,
          { role: 'assistant', text: (data.response || '').trim() },
        ]);
      }
      // Scroll to bottom after render
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
    } catch (e: any) {
      setChatMessages([
        ...nextMessages,
        {
          role: 'assistant',
          text: 'Quantum is momentarily out of reach. Please try again.',
        },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  // Reset chat state whenever a fresh reading is opened
  React.useEffect(() => {
    if (!showReading) {
      setChatOpen(false);
      setChatMessages([]);
      setChatInput('');
    }
  }, [showReading]);
  
  const cardFlipAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(1)).current;

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

  const saveToJournal = async () => {
    if (!currentReading) return;
    // Close the reading modal first to show journal prompt properly
    setShowReading(false);
    setShowJournalPrompt(true);
  };

  const confirmSaveToJournal = async () => {
    if (!currentReading) return;
    try {
      const cardSummary = currentReading.cards.map(card => 
        `${card.position}: ${card.card.name} - ${card.interpretation}`
      ).join('\n\n');

      const questionText = readingQuestion.trim() 
        ? `\nQuestion/Wisdom Sought: ${readingQuestion}\n\n` 
        : '\n';

      const journalEntry = {
        title: `Oracle Reading: ${selectedSpread?.name || 'Reading'}`,
        content: `Spread: ${selectedSpread?.name}\nDate: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}${questionText}${cardSummary}`,
        category: 'divination',
        entry_type: 'oracle',
        date: new Date().toISOString(),
        metadata: {
          spread_type: selectedSpread?.name,
          question: readingQuestion.trim() || null,
          reading_time: new Date().toISOString(),
          cards: currentReading.cards.map(c => ({
            position: c.position,
            card_name: c.card.name,
            element: c.card.element,
            interpretation: c.interpretation,
          })),
        },
      };

      // Get session token for authentication
      const sessionToken = await AsyncStorage.getItem('session_token');

      const response = await fetch(`${BACKEND_URL}/api/journal/entries`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
        },
        body: JSON.stringify(journalEntry),
      });

      if (response.ok) {
        Alert.alert('Saved!', 'Reading saved to your journal.');
        setShowJournalPrompt(false);
        setReadingQuestion('');
        // Close the reading modal and reset state
        setShowReading(false);
        setCurrentReading(null);
        setSelectedSpread(null);
        setCurrentCardIndex(0);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Could not save to journal. Please try again.');
      }
    } catch (error) {
      console.error('Error saving to journal:', error);
      Alert.alert('Error', 'Could not save to journal. Please try again.');
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
        <LinearGradient colors={['#1a0033', '#0d0015', '#000000']} style={StyleSheet.absoluteFill} />
        <Mist count={6} intensity="soft" />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Hero Section with Image Background */}
          <View style={styles.heroSection}>
            <Image source={{ uri: ORACLE_HERO_IMAGE }} style={styles.heroImage} contentFit="cover" />
            <LinearGradient
              colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.55)', 'rgba(13,0,21,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroEyebrow}>✦ Sacred Cards ✦</Text>
              <Text style={styles.heroTitle}>Oracle Divination</Text>
              <View style={styles.heroGlyphRow}>
                <View style={styles.heroGlyphLine} />
                <Ionicons name="sparkles" size={11} color={palette.gold} style={{ marginHorizontal: 8 }} />
                <View style={styles.heroGlyphLine} />
              </View>
              <Text style={styles.heroSubtitle}>Choose your card spread</Text>
            </View>
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
                      <RNImage
                        source={spread.image}
                        style={[styles.spreadThumbnail, isLocked && styles.lockedThumbnail]}
                        resizeMode="cover"
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
                          <SubscriptionOnlyBanner variant="badge" />
                        )}
                      </View>
                      <Text style={[styles.spreadName, isLocked && styles.lockedText]}>{spread.name}</Text>
                      <Text style={[styles.spreadDescription, isLocked && styles.lockedText]}>{spread.description}</Text>
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

        {/* Journal Save Prompt Modal */}
        <Modal visible={showJournalPrompt} animationType="fade" transparent>
          <View style={styles.journalPromptOverlay}>
            <View style={styles.journalPromptModal}>
              <View style={styles.journalPromptHeader}>
                <Ionicons name="book" size={28} color="#10b981" />
                <Text style={styles.journalPromptTitle}>Save to Journal</Text>
              </View>
              <Text style={styles.journalPromptSubtitle}>
                What question or wisdom were you seeking with this reading? (Optional)
              </Text>
              <TextInput
                style={styles.journalPromptInput}
                placeholder="e.g., Guidance about my career path..."
                placeholderTextColor="#9f7aea"
                value={readingQuestion}
                onChangeText={setReadingQuestion}
                multiline
                numberOfLines={3}
              />
              <View style={styles.journalPromptButtons}>
                <TouchableOpacity
                  style={[styles.journalPromptButton, styles.journalPromptCancel]}
                  onPress={() => {
                    setShowJournalPrompt(false);
                    setReadingQuestion('');
                  }}
                >
                  <Text style={styles.journalPromptCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.journalPromptButton, styles.journalPromptSave]}
                  onPress={confirmSaveToJournal}
                >
                  <Ionicons name="save" size={18} color="#fff" />
                  <Text style={styles.journalPromptSaveText}>Save Reading</Text>
                </TouchableOpacity>
              </View>
            </View>
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
                          source={{ 
                            uri: currentReading.cards[currentCardIndex].card.image_base64 
                              ? `data:image/png;base64,${currentReading.cards[currentCardIndex].card.image_base64}`
                              : currentReading.cards[currentCardIndex].card.image_url 
                          }}
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

                  {/* Fortune-teller's woven story of ALL the cards together */}
                  {currentReading.overall_interpretation ? (
                    <View style={styles.overallReadingSection}>
                      <View style={styles.overallHeader}>
                        <Ionicons name="eye" size={20} color="#fbbf24" />
                        <Text style={styles.overallTitle}>
                          The Reader{'\u2019'}s Full Vision
                        </Text>
                      </View>
                      <View style={styles.overallDivider} />
                      <Text style={styles.overallBody}>
                        {currentReading.overall_interpretation}
                      </Text>
                    </View>
                  ) : null}

                  {/* Chat with Quantum AI — follow-up conversation */}
                  <View style={styles.quantumSection}>
                    {!chatOpen ? (
                      <TouchableOpacity
                        style={styles.quantumOpenBtn}
                        onPress={() => setChatOpen(true)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.quantumOpenLeft}>
                          <View style={styles.quantumIconWrap}>
                            <Ionicons name="planet" size={22} color="#e9d5ff" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.quantumOpenTitle}>
                              Chat with Quantum AI
                            </Text>
                            <Text style={styles.quantumOpenSubtitle}>
                              Ask deeper questions about your reading
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#c4b5fd" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.quantumChat}>
                        <View style={styles.quantumChatHeader}>
                          <View style={styles.quantumChatHeaderLeft}>
                            <Ionicons name="planet" size={18} color="#a855f7" />
                            <Text style={styles.quantumChatTitle}>Quantum</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setChatOpen(false)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="close" size={18} color="#c4b5fd" />
                          </TouchableOpacity>
                        </View>
                        <ScrollView
                          ref={chatScrollRef}
                          style={styles.quantumMessages}
                          contentContainerStyle={styles.quantumMessagesContent}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={false}
                        >
                          {chatMessages.length === 0 ? (
                            <Text style={styles.quantumEmpty}>
                              I have read the pattern of your cards. Ask me
                              anything — about the elements, the progression,
                              a specific card, or the way forward.
                            </Text>
                          ) : (
                            chatMessages.map((m, idx) => (
                              <View
                                key={idx}
                                style={[
                                  styles.chatBubble,
                                  m.role === 'user'
                                    ? styles.chatBubbleUser
                                    : styles.chatBubbleAssistant,
                                ]}
                              >
                                {m.role === 'assistant' ? (
                                  <View style={styles.chatBubbleLabelRow}>
                                    <Ionicons
                                      name="planet"
                                      size={12}
                                      color="#a855f7"
                                    />
                                    <Text style={styles.chatBubbleLabel}>Quantum</Text>
                                  </View>
                                ) : null}
                                <Text
                                  style={
                                    m.role === 'user'
                                      ? styles.chatBubbleTextUser
                                      : styles.chatBubbleTextAssistant
                                  }
                                >
                                  {m.text}
                                </Text>
                              </View>
                            ))
                          )}
                          {chatSending ? (
                            <View
                              style={[styles.chatBubble, styles.chatBubbleAssistant]}
                            >
                              <ActivityIndicator size="small" color="#a855f7" />
                            </View>
                          ) : null}
                        </ScrollView>

                        <View style={styles.quantumInputRow}>
                          <TextInput
                            style={styles.quantumInput}
                            value={chatInput}
                            onChangeText={setChatInput}
                            placeholder="Ask about your reading…"
                            placeholderTextColor="#7c6ba0"
                            multiline
                            maxLength={500}
                            editable={!chatSending}
                            onSubmitEditing={sendChat}
                            blurOnSubmit={false}
                          />
                          <TouchableOpacity
                            style={[
                              styles.quantumSendBtn,
                              (!chatInput.trim() || chatSending) &&
                                styles.quantumSendBtnDisabled,
                            ]}
                            onPress={sendChat}
                            disabled={!chatInput.trim() || chatSending}
                          >
                            <Ionicons
                              name="send"
                              size={16}
                              color={
                                !chatInput.trim() || chatSending
                                  ? '#7c6ba0'
                                  : '#0f0321'
                              }
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveToJournal}
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

      {/* Journal Save Prompt Modal - for Card Drawing View */}
      <Modal visible={showJournalPrompt} animationType="fade" transparent>
        <View style={styles.journalPromptOverlay}>
          <View style={styles.journalPromptModal}>
            <View style={styles.journalPromptHeader}>
              <Ionicons name="book" size={28} color="#10b981" />
              <Text style={styles.journalPromptTitle}>Save to Journal</Text>
            </View>
            <Text style={styles.journalPromptSubtitle}>
              What question or wisdom were you seeking with this reading? (Optional)
            </Text>
            <TextInput
              style={styles.journalPromptInput}
              placeholder="e.g., Guidance about my career path..."
              placeholderTextColor="#9f7aea"
              value={readingQuestion}
              onChangeText={setReadingQuestion}
              multiline
              numberOfLines={3}
            />
            <View style={styles.journalPromptButtons}>
              <TouchableOpacity
                style={[styles.journalPromptButton, styles.journalPromptCancel]}
                onPress={() => {
                  setShowJournalPrompt(false);
                  setReadingQuestion('');
                  // Reopen the reading modal
                  setShowReading(true);
                }}
              >
                <Text style={styles.journalPromptCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.journalPromptButton, styles.journalPromptSave]}
                onPress={confirmSaveToJournal}
              >
                <Ionicons name="save" size={18} color="#fff" />
                <Text style={styles.journalPromptSaveText}>Save Reading</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0015',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  heroSection: {
    height: 170,
    position: 'relative',
    marginHorizontal: -12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: palette.gold,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.starWhite,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroGlyphRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  heroGlyphLine: { width: 32, height: 1, backgroundColor: 'rgba(251,191,36,0.6)' },
  heroSubtitle: {
    fontSize: 12,
    color: palette.mist,
    textAlign: 'center',
    letterSpacing: 0.3,
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
    backgroundColor: 'rgba(26, 10, 46, 0.6)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(183, 148, 246, 0.25)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
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
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  positionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    flexShrink: 0,
  },
  positionNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  positionName: {
    color: '#c4b5fd',
    fontSize: 14,
    flexShrink: 0,
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
    padding: 12,
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
    padding: 12,
  },
  modalContent: {
    backgroundColor: '#1a0033',
    borderRadius: 24,
    padding: 16,
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
    paddingHorizontal: 12,
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
  overallReadingSection: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    backgroundColor: 'rgba(30,14,58,0.75)',
  },
  overallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  overallTitle: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  overallDivider: {
    height: 1,
    backgroundColor: 'rgba(251,191,36,0.35)',
    marginBottom: 12,
  },
  overallBody: {
    color: '#e9d5ff',
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
  },

  // ---- Quantum AI chat ----
  quantumSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  quantumOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.55)',
    backgroundColor: 'rgba(30,14,58,0.75)',
  },
  quantumOpenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  quantumIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.6)',
  },
  quantumOpenTitle: {
    color: '#e9d5ff',
    fontSize: 15,
    fontWeight: '800',
  },
  quantumOpenSubtitle: {
    color: '#c4b5fd',
    fontSize: 12,
    marginTop: 2,
  },
  quantumChat: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.55)',
    backgroundColor: 'rgba(15,5,35,0.85)',
    overflow: 'hidden',
  },
  quantumChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(30,14,58,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168,85,247,0.35)',
  },
  quantumChatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantumChatTitle: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quantumMessages: {
    maxHeight: 320,
  },
  quantumMessagesContent: {
    padding: 12,
    gap: 8,
  },
  quantumEmpty: {
    color: '#9f7aea',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chatBubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: '90%',
    marginBottom: 8,
  },
  chatBubbleUser: {
    backgroundColor: 'rgba(168,85,247,0.85)',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  chatBubbleAssistant: {
    backgroundColor: 'rgba(30,14,58,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  chatBubbleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  chatBubbleLabel: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  chatBubbleTextUser: {
    color: '#0f0321',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  chatBubbleTextAssistant: {
    color: '#e9d5ff',
    fontSize: 14,
    lineHeight: 21,
  },
  quantumInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(15,5,35,0.85)',
  },
  quantumInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    color: '#e9d5ff',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(30,14,58,0.8)',
  },
  quantumSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantumSendBtnDisabled: {
    backgroundColor: 'rgba(45,27,78,0.7)',
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 12,
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
  journalButton: {
    backgroundColor: '#10b981',
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
    padding: 12,
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
  // Journal Prompt Modal Styles
  journalPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  journalPromptModal: {
    backgroundColor: '#1a0033',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  journalPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  journalPromptTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e9d5ff',
  },
  journalPromptSubtitle: {
    fontSize: 15,
    color: '#c4b5fd',
    marginBottom: 16,
    lineHeight: 22,
  },
  journalPromptInput: {
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    padding: 16,
    color: '#e9d5ff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#4a3b6e',
  },
  journalPromptButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  journalPromptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  journalPromptCancel: {
    backgroundColor: '#2d1b4e',
    borderWidth: 1,
    borderColor: '#4a3b6e',
  },
  journalPromptCancelText: {
    color: '#c4b5fd',
    fontSize: 16,
    fontWeight: '600',
  },
  journalPromptSave: {
    backgroundColor: '#7c3aed',
  },
  journalPromptSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
