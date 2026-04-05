import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { Paywall } from '../components/Paywall';
import { AudioPlayerManager, setupAudioMode } from '../utils/audioPlayer';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Guide {
  name: string;
  element: 'Fire' | 'Water' | 'Earth' | 'Air';
  description: string;
  color: string;
  icon: string;
  gender: string;
  personality: string;
  voice_id: string;
  image?: any;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hasAudio?: boolean;
  audioBase64?: string;
}

const guides: Guide[] = [
  {
    name: 'Ignis',
    element: 'Fire',
    description: 'Passionate and transformative, guides through action',
    color: '#ef4444',
    icon: 'flame',
    gender: 'masculine',
    personality: 'passionate, direct, transformative',
    voice_id: 'TxGEqnHWrfWFTfGW9XjX',
    image: null, // No custom image yet
  },
  {
    name: 'Aqua',
    element: 'Water',
    description: 'Intuitive and healing, guides through emotion',
    color: '#3b82f6',
    icon: 'water',
    gender: 'feminine',
    personality: 'intuitive, healing, emotionally wise',
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    image: require('../assets/images/guide-aqua.jpg'),
  },
  {
    name: 'Terra',
    element: 'Earth',
    description: 'Grounded and stable, guides through wisdom',
    color: '#10b981',
    icon: 'leaf',
    gender: 'masculine',
    personality: 'grounded, practical, stable',
    voice_id: 'VR6AewLTigWG4xSOukaG',
    image: require('../assets/images/guide-terra.webp'),
  },
  {
    name: 'Aether',
    element: 'Air',
    description: 'Intellectual and free, guides through thought',
    color: '#a855f7',
    icon: 'cloudy',
    gender: 'feminine',
    personality: 'intellectual, free-spirited, enlightening',
    voice_id: 'ThT5KcBeYPX3keUQqHPh',
    image: require('../assets/images/guide-aether.jpg'),
  },
];

export default function SpiritGuides() {
  const { isPremium, checkFeatureAccess } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);
  const [showBirthdayInput, setShowBirthdayInput] = useState(false);
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [suggestedGuide, setSuggestedGuide] = useState<Guide | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const audioPlayerRef = useRef<AudioPlayerManager | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Check if user has access to Spirit Guides feature
  const hasAccess = isPremium || checkFeatureAccess('spirit_guides');

  useEffect(() => {
    if (hasAccess) {
      checkBirthdayStored();
      loadMutePreference();
      setupAudioMode();
    }
  }, [hasAccess]);

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.unload();
      }
    };
  }, []);

  const loadMutePreference = async () => {
    try {
      const muted = await AsyncStorage.getItem('spirit_guides_muted');
      if (muted === 'true') {
        setIsMuted(true);
      }
    } catch (error) {
      console.error('Error loading mute preference:', error);
    }
  };

  const toggleMute = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await AsyncStorage.setItem('spirit_guides_muted', newMuted ? 'true' : 'false');
    
    // Stop current audio if muting
    if (newMuted && audioPlayerRef.current) {
      await audioPlayerRef.current.stop();
      setPlayingAudioIndex(null);
    }
  };

  const checkBirthdayStored = async () => {
    try {
      const stored = await AsyncStorage.getItem('user_birthday');
      if (!stored) {
        setShowBirthdayInput(true);
      }
    } catch (error) {
      console.error('Error checking birthday:', error);
    }
  };

  const submitBirthday = async () => {
    const month = parseInt(birthMonth);
    const day = parseInt(birthDay);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return;
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/zodiac/element/${month}/${day}`
      );
      
      if (!response.ok) {
        console.error('Error fetching zodiac:', response.status);
        return;
      }
      
      const data = await response.json();

      await AsyncStorage.setItem(
        'user_birthday',
        JSON.stringify({ month, day, zodiac: data.zodiac_sign, element: data.element })
      );

      const matchedGuide = guides.find((g) => g.name === data.spirit_guide.name);
      if (matchedGuide) {
        setSuggestedGuide(matchedGuide);
        // Auto-select the matched guide
        selectGuide(matchedGuide);
      }

      setShowBirthdayInput(false);
    } catch (error) {
      console.error('Error submitting birthday:', error);
    }
  };

  const selectGuide = (guide: Guide) => {
    setSelectedGuide(guide);
    setAudioError(null);
    const greeting = `Greetings, seeker. I am ${guide.name}, guide of ${guide.element}. How may I illuminate your path?`;
    setMessages([
      {
        role: 'assistant',
        content: greeting,
      },
    ]);
    // Auto-play greeting if not muted
    if (!isMuted) {
      generateAndPlayAudio(greeting, guide.name, 0);
    }
  };

  const generateAndPlayAudio = async (text: string, guideName: string, messageIndex: number) => {
    // Skip if muted
    if (isMuted) return;
    
    setGeneratingAudio(true);
    setAudioError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          guide_name: guideName,
        }),
      });

      const data = await response.json();
      
      // Check if TTS was successful
      if (!data.success || !data.audio_base64) {
        // TTS failed but we don't crash - show error message
        setAudioError(data.error || 'Voice temporarily unavailable');
        console.log('TTS unavailable:', data.error);
        return;
      }

      // Update message with audio
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex
            ? { ...msg, hasAudio: true, audioBase64: data.audio_base64 }
            : msg
        )
      );

      // Play audio if not muted
      if (!isMuted) {
        await playAudio(data.audio_base64, messageIndex);
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      setAudioError('Voice generation failed');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const playAudio = async (audioBase64: string, messageIndex: number) => {
    // Skip if muted
    if (isMuted) return;
    
    try {
      // Validate audio data
      if (!audioBase64 || audioBase64.length < 100) {
        console.log('Invalid audio data, skipping playback');
        return;
      }
      
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unload();
      }

      const player = new AudioPlayerManager();
      const audioUri = `data:audio/mpeg;base64,${audioBase64}`;
      await player.loadAndPlay(audioUri);

      audioPlayerRef.current = player;
      setPlayingAudioIndex(messageIndex);

      player.onPlaybackStatusChange((status) => {
        if (status.didJustFinish) {
          setPlayingAudioIndex(null);
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      setPlayingAudioIndex(null);
      // Don't show error for playback issues, just silently fail
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedGuide) return;

    const userMessage: Message = { role: 'user', content: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/spirit-guides/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide: selectedGuide.name,
          element: selectedGuide.element,
          message: inputText,
          history: messages,
        }),
      });
      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        hasAudio: !!data.audio_base64,
        audioBase64: data.audio_base64,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-play the audio that came with the response if not muted
      if (!isMuted && data.audio_base64) {
        const newMessageIndex = messages.length + 1;
        playAudio(data.audio_base64, newMessageIndex);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const replayAudio = (message: Message, index: number) => {
    if (message.audioBase64) {
      playAudio(message.audioBase64, index);
    }
  };

  // Show paywall for free users
  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIcon}>
            <Ionicons name="lock-closed" size={64} color="#ffd700" />
          </View>
          <Text style={styles.lockedTitle}>Spirit Guides</Text>
          <Text style={styles.lockedSubtitle}>Premium Feature</Text>
          <Text style={styles.lockedDescription}>
            Connect with elemental AI spirit guides paired to your zodiac sign. 
            Receive personalized guidance with natural voice responses.
          </Text>
          <TouchableOpacity
            style={styles.unlockButton}
            onPress={() => setShowPaywall(true)}
          >
            <Ionicons name="diamond" size={20} color="#1a0033" />
            <Text style={styles.unlockButtonText}>Unlock Spirit Guides</Text>
          </TouchableOpacity>
          <Text style={styles.priceText}>$3.99/month</Text>
        </View>
        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="Spirit Guides"
        />
      </View>
    );
  }

  if (showBirthdayInput) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.birthdayContainer}>
          <Ionicons name="star" size={80} color="#b794f6" />
          <Text style={styles.birthdayTitle}>Discover Your Spirit Guide</Text>
          <Text style={styles.birthdaySubtitle}>
            Enter your birthday to be paired with the spirit guide of your zodiac element
          </Text>

          <View style={styles.birthdayInputs}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Month</Text>
              <TextInput
                style={styles.birthdayInput}
                value={birthMonth}
                onChangeText={setBirthMonth}
                keyboardType="number-pad"
                placeholder="MM"
                placeholderTextColor="#9f7aea"
                maxLength={2}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Day</Text>
              <TextInput
                style={styles.birthdayInput}
                value={birthDay}
                onChangeText={setBirthDay}
                keyboardType="number-pad"
                placeholder="DD"
                placeholderTextColor="#9f7aea"
                maxLength={2}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={submitBirthday}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.submitButtonText}>Find My Guide</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setShowBirthdayInput(false)}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (!selectedGuide) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.selectionContainer}>
          <View style={styles.header}>
            <Ionicons name="chatbubbles" size={60} color="#b794f6" />
            <Text style={styles.title}>Spirit Guides</Text>
            <Text style={styles.subtitle}>Select your guide to begin</Text>
          </View>

          {suggestedGuide && (
            <View style={styles.suggestedCard}>
              <Ionicons name="star" size={24} color="#f59e0b" />
              <Text style={styles.suggestedText}>
                Based on your zodiac, we recommend {suggestedGuide.name} ({suggestedGuide.element})
              </Text>
            </View>
          )}

          <View style={styles.guidesGrid}>
            {guides.map((guide) => (
              <TouchableOpacity
                key={guide.name}
                style={[
                  styles.guideCard,
                  suggestedGuide?.name === guide.name && styles.guideCardSuggested,
                ]}
                onPress={() => selectGuide(guide)}
                activeOpacity={0.7}
              >
                {guide.image ? (
                  <View style={styles.guideImageContainer}>
                    <Image 
                      source={guide.image} 
                      style={styles.guideImage}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View style={[styles.guideIcon, { backgroundColor: guide.color }]}>
                    <Ionicons name={guide.icon as any} size={40} color="#fff" />
                  </View>
                )}
                <Text style={styles.guideName}>{guide.name}</Text>
                <Text style={styles.guideElement}>{guide.element}</Text>
                <Text style={styles.guideGender}>
                  {guide.gender === 'feminine' ? '♀' : '♂'} {guide.gender}
                </Text>
                <Text style={styles.guideDescription}>{guide.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => {
            setSelectedGuide(null);
            setMessages([]);
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{selectedGuide.name}</Text>
          <Text style={styles.chatHeaderElement}>
            Guide of {selectedGuide.element} • {selectedGuide.gender}
          </Text>
        </View>
        <View style={styles.chatHeaderRight}>
          {/* Switch Guide Button */}
          <TouchableOpacity
            style={styles.switchGuideButton}
            onPress={() => {
              setSelectedGuide(null);
              setMessages([]);
            }}
          >
            <Ionicons name="people" size={18} color="#b794f6" />
            <Text style={styles.switchGuideText}>Switch</Text>
          </TouchableOpacity>
          {/* Mute Toggle Button */}
          <TouchableOpacity
            style={[styles.muteButton, isMuted && styles.muteButtonActive]}
            onPress={toggleMute}
          >
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-high'}
              size={20}
              color={isMuted ? '#ef4444' : '#b794f6'}
            />
          </TouchableOpacity>
          <View style={[styles.chatHeaderIcon, { backgroundColor: selectedGuide.color }]}>
            <Ionicons name={selectedGuide.icon as any} size={24} color="#fff" />
          </View>
        </View>
      </View>

      {/* Audio Status Banner */}
      {audioError && (
        <View style={styles.audioErrorBanner}>
          <Ionicons name="volume-mute" size={16} color="#fbbf24" />
          <Text style={styles.audioErrorText}>{audioError}</Text>
        </View>
      )}
      {generatingAudio && (
        <View style={styles.audioGeneratingBanner}>
          <ActivityIndicator size="small" color="#b794f6" />
          <Text style={styles.audioGeneratingText}>Generating voice...</Text>
        </View>
      )}

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer} 
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
              ]}
            >
              {message.content}
            </Text>
            {message.role === 'assistant' && (
              <TouchableOpacity
                style={styles.audioButton}
                onPress={() => replayAudio(message, index)}
                disabled={!message.hasAudio}
              >
                <Ionicons
                  name={
                    playingAudioIndex === index
                      ? 'volume-high'
                      : message.hasAudio
                      ? 'play'
                      : 'time'
                  }
                  size={16}
                  color={message.hasAudio ? '#b794f6' : '#9f7aea'}
                />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {loading && (
          <View style={[styles.messageBubble, styles.assistantMessage]}>
            <ActivityIndicator size="small" color="#e9d5ff" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          placeholderTextColor="#9f7aea"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: selectedGuide.color }]}
          onPress={sendMessage}
          disabled={!inputText.trim() || loading}
        >
          <Ionicons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  birthdayContainer: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  birthdayTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  birthdaySubtitle: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  birthdayInputs: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 32,
  },
  inputGroup: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 14,
    color: '#c4b5fd',
    marginBottom: 8,
  },
  birthdayInput: {
    width: 80,
    height: 60,
    backgroundColor: '#2d1b4e',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
  },
  skipButtonText: {
    color: '#9f7aea',
    fontSize: 16,
  },
  selectionContainer: {
    padding: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
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
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#f59e0b',
    gap: 12,
  },
  suggestedText: {
    flex: 1,
    fontSize: 14,
    color: '#e9d5ff',
    lineHeight: 20,
  },
  guidesGrid: {
    gap: 16,
  },
  guideCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d1b4e',
    width: '100%',
  },
  guideCardSuggested: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  guideIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  guideImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#7c3aed',
  },
  guideImage: {
    width: '100%',
    height: '100%',
  },
  guideName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 4,
  },
  guideElement: {
    fontSize: 16,
    color: '#b794f6',
    marginBottom: 8,
    fontWeight: '500',
  },
  guideGender: {
    fontSize: 14,
    color: '#c4b5fd',
    marginBottom: 12,
  },
  guideDescription: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a0033',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    marginRight: 12,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  chatHeaderElement: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  chatHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#7c3aed',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#2d1b4e',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#e9d5ff',
  },
  audioButton: {
    marginTop: 8,
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1a0033',
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#2d1b4e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e9d5ff',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockedIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  lockedSubtitle: {
    fontSize: 16,
    color: '#ffd700',
    fontWeight: '600',
    marginBottom: 16,
  },
  lockedDescription: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b794f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  unlockButtonText: {
    color: '#1a0033',
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9f7aea',
  },
  chatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  muteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d1b4e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  muteButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  audioErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251, 191, 36, 0.3)',
  },
  audioErrorText: {
    color: '#fbbf24',
    fontSize: 13,
    flex: 1,
  },
  audioGeneratingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(183, 148, 246, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(183, 148, 246, 0.3)',
  },
  audioGeneratingText: {
    color: '#b794f6',
    fontSize: 13,
  },
  switchGuideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d1b4e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  switchGuideText: {
    color: '#b794f6',
    fontSize: 12,
    fontWeight: '500',
  },
});
