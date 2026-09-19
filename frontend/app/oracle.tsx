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
  Alert,
  Image as RNImage,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { Paywall } from '../components/Paywall';
import SubscriptionOnlyBanner from '../components/SubscriptionOnlyBanner';
import { Mist } from '../components/ui';
import { AudioPlayerManager } from '../utils/audioPlayer';
import QuantumWaveform from '../components/QuantumWaveform';
import { palette } from '../theme/tokens';
import { useBottomSafePad } from '../hooks/useBottomSafePad';
import {
  SPREAD_TYPES,
  ORACLE_HERO_IMAGE,
  type Reading,
  type SpreadType,
} from '../constants/oracle';
import { oracleStyles as styles } from '../styles/oracle.styles';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Resolve an Oracle card's image to a full URI the <Image/> component can
 * load. Prefers the server-hosted `image_url` (relative or absolute) so the
 * /draw JSON response stays tiny — the previous behaviour of embedding a
 * multi-MB base64 PNG per card reliably crashed the mobile client on
 * multi-card spreads. Falls back to `image_base64` for older saved
 * readings that still store the blob.
 */
function cardImageUri(card: {
  image_url?: string | null;
  image_base64?: string | null;
} | undefined): string | undefined {
  if (!card) return undefined;
  const url = card.image_url;
  if (url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Server returns "/api/oracle/card-image/…" — prepend the backend host.
    return `${BACKEND_URL || ''}${url}`;
  }
  if (card.image_base64) {
    return `data:image/png;base64,${card.image_base64}`;
  }
  return undefined;
}

export default function Oracle() {
  const { isPremium } = useAuth();
  const bottomPad = useBottomSafePad();
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
  const [savedReadingId, setSavedReadingId] = useState<string | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [loadingAudioIdx, setLoadingAudioIdx] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ currentTime: number; duration: number }>({
    currentTime: 0,
    duration: 0,
  });
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);
  const chatScrollRef = React.useRef<ScrollView | null>(null);
  const quantumPlayerRef = React.useRef<AudioPlayerManager | null>(null);
  const speakQuantumReplyRef = React.useRef<
    ((text: string, idx: number) => Promise<void>) | null
  >(null);
  const progressPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted auto-play preference on mount.
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('quantum_autoplay_voice');
        if (v === '1') setAutoPlayVoice(true);
      } catch {}
    })();
  }, []);

  const toggleAutoPlay = async () => {
    setAutoPlayVoice((prev) => {
      const next = !prev;
      AsyncStorage.setItem('quantum_autoplay_voice', next ? '1' : '0').catch(() => {});
      return next;
    });
  };

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
      let assistantText = '';
      if (!r.ok) {
        assistantText =
          data?.detail ||
          'Quantum is momentarily out of reach. Please try again.';
      } else {
        assistantText = (data.response || '').trim();
      }
      setChatMessages([
        ...nextMessages,
        { role: 'assistant', text: assistantText },
      ]);
      // Auto-play the new Quantum reply if user has enabled it.
      if (r.ok && assistantText && autoPlayVoice) {
        const newIdx = nextMessages.length; // assistant bubble index
        // Small delay so the bubble is rendered before playback + polling starts.
        setTimeout(() => {
          speakQuantumReplyRef.current?.(assistantText, newIdx).catch(() => {});
        }, 150);
      }
      // Persist to the saved reading if it has been saved.
      if (r.ok && savedReadingId) {
        try {
          const token = await AsyncStorage.getItem('session_token');
          await fetch(
            `${backendUrl}/api/oracle/readings/${savedReadingId}/chat`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                user_text: q,
                assistant_text: assistantText,
              }),
            },
          );
        } catch {
          // silent — chat still shows locally even if persistence fails
        }
      }
      // Scroll to bottom after render
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
    } catch {
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

  const speakQuantumReply = async (text: string, idx: number) => {
    if (!text.trim()) return;
    // Toggle off if this bubble is already playing.
    if (playingIdx === idx) {
      try {
        await quantumPlayerRef.current?.unload();
      } catch {}
      quantumPlayerRef.current = null;
      setPlayingIdx(null);
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
      setAudioProgress({ currentTime: 0, duration: 0 });
      return;
    }
    // Stop any previously playing bubble first.
    try {
      await quantumPlayerRef.current?.unload();
    } catch {}
    quantumPlayerRef.current = null;
    if (progressPollRef.current) {
      clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }
    setAudioProgress({ currentTime: 0, duration: 0 });

    setLoadingAudioIdx(idx);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      const r = await fetch(`${backendUrl}/api/oracle/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        Alert.alert(
          'Voice unavailable',
          err?.detail || 'Please try again shortly.',
        );
        return;
      }
      const blob = await r.blob();
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to decode audio'));
        reader.onloadend = () => {
          const raw = String(reader.result || '');
          const idxComma = raw.indexOf(',');
          resolve(idxComma >= 0 ? raw.slice(idxComma + 1) : raw);
        };
        reader.readAsDataURL(blob);
      });
      const player = new AudioPlayerManager();
      await player.loadAndPlay(`data:audio/mp3;base64,${b64}`, {
        loop: false,
        volume: 0.95,
      });
      quantumPlayerRef.current = player;
      setPlayingIdx(idx);
      // Poll for progress + completion.
      progressPollRef.current = setInterval(async () => {
        const cur = quantumPlayerRef.current?.getCurrentTime() ?? 0;
        const dur = quantumPlayerRef.current?.getDuration() ?? 0;
        setAudioProgress({ currentTime: cur, duration: dur });
        if (dur > 0 && cur >= dur - 0.3) {
          if (progressPollRef.current) {
            clearInterval(progressPollRef.current);
            progressPollRef.current = null;
          }
          try {
            await quantumPlayerRef.current?.unload();
          } catch {}
          quantumPlayerRef.current = null;
          setPlayingIdx((p) => (p === idx ? null : p));
          setAudioProgress({ currentTime: 0, duration: 0 });
        }
      }, 250);
    } catch (e: any) {
      Alert.alert('Voice error', e?.message || 'Please try again.');
    } finally {
      setLoadingAudioIdx(null);
    }
  };

  // Keep a stable ref for auto-play from sendChat (avoids stale closures).
  useEffect(() => {
    speakQuantumReplyRef.current = speakQuantumReply;
  });

  // Cleanup audio on unmount / modal close
  React.useEffect(() => {
    return () => {
      quantumPlayerRef.current?.unload().catch(() => {});
      if (progressPollRef.current) {
        clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
    };
  }, []);

  // Reset chat state whenever the reading modal fully closes.
  React.useEffect(() => {
    if (!showReading) {
      setChatOpen(false);
      setChatMessages([]);
      setChatInput('');
      setSavedReadingId(null);
      setPlayingIdx(null);
      quantumPlayerRef.current?.unload().catch(() => {});
      quantumPlayerRef.current = null;
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
      
      // Card flip animation. `useNativeDriver` is deliberately FALSE here —
      // interpolating rotateY through a full 360° with the native driver
      // has been reported to crash iOS Expo builds. JS driver handles a
      // single 800 ms tween without any perceptible perf cost.
      cardFlipAnim.setValue(0);
      setShowReading(true);
      Animated.timing(cardFlipAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      console.error('Error drawing cards:', error);
      Alert.alert('Connection Error', 'Unable to connect to the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const openSavedReading = (reading: Reading) => {
    // Restore Quantum chat state alongside the reading. If the reading has
    // no persisted chat_history we start empty. `savedReadingId` is set so
    // future chats append to this record via PATCH.
    setCurrentReading(reading);
    setCurrentCardIndex(0);
    setSavedReadingId(reading._id || reading.reading_id || null);
    const restored = (reading.chat_history || []).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      text: m.text,
    }));
    setChatMessages(restored);
    setChatOpen(restored.length > 0);
    setShowHistory(false);
    setShowReading(true);
  };


  const saveReading = async () => {
    if (!currentReading) return;
    try {
      const token = await AsyncStorage.getItem('session_token');
      const r = await fetch(`${BACKEND_URL}/api/oracle/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...currentReading,
          chat_history: chatMessages,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data?.reading_id) {
        setSavedReadingId(data.reading_id);
      }
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
        // Also persist the reading + Quantum chat_history to the oracle DB so
        // the seeker can re-open it from the History tab and continue the
        // conversation.
        try {
          const saveResp = await fetch(`${BACKEND_URL}/api/oracle/save`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
            },
            body: JSON.stringify({
              ...currentReading,
              chat_history: chatMessages,
            }),
          });
          const saveData = await saveResp.json().catch(() => ({}));
          if (saveResp.ok && saveData?.reading_id) {
            setSavedReadingId(saveData.reading_id);
          }
        } catch {
          // best-effort persistence — never block the journal save
        }
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
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${BACKEND_URL}/api/oracle/readings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();
      setSavedReadings(Array.isArray(data) ? data : []);
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

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
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
                    <TouchableOpacity
                      key={reading._id || index}
                      style={styles.historyCard}
                      activeOpacity={0.8}
                      onPress={() => openSavedReading(reading)}
                    >
                      <View style={styles.historyCardContent}>
                        <Text style={styles.historySpreadType}>
                          {SPREAD_TYPES.find(s => s.id === reading.spread_type)?.name || 'Reading'}
                        </Text>
                        <Text style={styles.historyCardCount}>
                          {reading.cards?.length || 1} card{(reading.cards?.length || 1) > 1 ? 's' : ''}
                          {reading.chat_history && reading.chat_history.length > 0
                            ? ` · 💬 ${Math.floor(reading.chat_history.length / 2)} Quantum reply${Math.floor(reading.chat_history.length / 2) === 1 ? '' : 'ies'}`
                            : ''}
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(reading.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9f7aea" />
                    </TouchableOpacity>
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
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
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
                        {(() => {
                          const uri = cardImageUri(
                            currentReading.cards[currentCardIndex].card,
                          );
                          return uri ? (
                            <Image
                              source={{ uri }}
                              style={styles.cardImage}
                              contentFit="cover"
                              transition={300}
                            />
                          ) : (
                            /* Placeholder while background image gen finishes —
                               previously we passed `{ uri: undefined }` which
                               crashed some native Image builds. */
                            <View
                              style={[
                                styles.cardImage,
                                {
                                  backgroundColor: 'rgba(45,27,78,0.6)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                },
                              ]}
                            >
                              <ActivityIndicator size="large" color="#b794f6" />
                            </View>
                          );
                        })()}
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
                          <View style={styles.quantumHeaderActions}>
                            <TouchableOpacity
                              onPress={toggleAutoPlay}
                              style={[
                                styles.autoPlayPill,
                                autoPlayVoice && styles.autoPlayPillOn,
                              ]}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel={
                                autoPlayVoice
                                  ? 'Disable auto-play voice'
                                  : 'Enable auto-play voice'
                              }
                            >
                              <Ionicons
                                name={autoPlayVoice ? 'volume-high' : 'volume-mute'}
                                size={11}
                                color={autoPlayVoice ? '#0f0321' : '#c4b5fd'}
                              />
                              <Text
                                style={[
                                  styles.autoPlayPillText,
                                  autoPlayVoice && styles.autoPlayPillTextOn,
                                ]}
                              >
                                Auto-play {autoPlayVoice ? 'on' : 'off'}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setChatOpen(false)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Ionicons name="close" size={18} color="#c4b5fd" />
                            </TouchableOpacity>
                          </View>
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
                                    <TouchableOpacity
                                      onPress={() => speakQuantumReply(m.text, idx)}
                                      style={styles.chatSpeakerBtn}
                                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                      accessibilityLabel={
                                        playingIdx === idx ? 'Stop voice' : 'Play voice'
                                      }
                                    >
                                      {loadingAudioIdx === idx ? (
                                        <ActivityIndicator size="small" color="#a855f7" />
                                      ) : (
                                        <Ionicons
                                          name={
                                            playingIdx === idx
                                              ? 'stop-circle'
                                              : 'volume-high'
                                          }
                                          size={14}
                                          color={
                                            playingIdx === idx ? '#fbbf24' : '#a855f7'
                                          }
                                        />
                                      )}
                                    </TouchableOpacity>
                                    {playingIdx === idx ? (
                                      <QuantumWaveform
                                        active
                                        currentTime={audioProgress.currentTime}
                                        duration={audioProgress.duration}
                                      />
                                    ) : null}
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

