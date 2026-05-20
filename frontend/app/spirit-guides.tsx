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
  Animated,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import SubscriptionOnlyBanner from '../components/SubscriptionOnlyBanner';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Paywall } from '../components/Paywall';
import HeaderBanner from '../components/HeaderBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { Mist } from '../components/ui';
import { palette } from '../theme/tokens';
import { AudioPlayerManager, setupAudioMode } from '../utils/audioPlayer';
import {
  Guide,
  Message,
  elementalGuides,
  lgbtqGuides,
  customGuidesBase,
  divineGuides,
  guides,
  SPIRIT_GUIDES_HERO_IMAGE,
} from '../constants/guides';
import { styles } from '../components/guides/styles';
import RenameModal from '../components/guides/RenameModal';
import BirthdayPicker from '../components/guides/BirthdayPicker';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;


export default function SpiritGuides() {
  const { isPremium, previewAsFree, checkFeatureAccess } = useAuth();
  const { languageCode, t } = useLanguage();
  const router = useRouter();
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
  
  // Animation for pulsating ring when guide is talking
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  // Custom Guide names + rename modal state
  const [customNames, setCustomNames] = useState<{ male: string; female: string }>({
    male: 'Male Guide',
    female: 'Female Guide',
  });
  const [customUnlocked, setCustomUnlocked] = useState<boolean>(true);
  const [divineUnlocked, setDivineUnlocked] = useState<boolean>(false);
  const [inFreePromo, setInFreePromo] = useState<boolean>(true);
  const [prideMonth, setPrideMonth] = useState<boolean>(false);
  const [renameModal, setRenameModal] = useState<null | 'male' | 'female'>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const [renameSaving, setRenameSaving] = useState<boolean>(false);
  const [divinePairMode, setDivinePairMode] = useState<boolean>(false);
  
  // Check if guide is currently "talking" (loading response, generating audio, or playing audio)
  const isTalking = loading || generatingAudio || playingAudioIndex !== null;

  // Check if user has access to Spirit Guides feature
  const hasAccess = isPremium || checkFeatureAccess('spirit_guides');
  
  // Pulsating animation effect when guide is talking
  useEffect(() => {
    if (isTalking && selectedGuide) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.8,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      // Reset to default state
      pulseAnim.setValue(1);
      glowAnim.setValue(0.3);
    }
  }, [isTalking, selectedGuide]);

  useEffect(() => {
    if (hasAccess) {
      checkBirthdayStored();
      loadMutePreference();
      setupAudioMode();
      loadCustomGuideInfo();
    }
  }, [hasAccess, previewAsFree]);

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

  const loadCustomGuideInfo = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [namesRes, accessRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/spirit-guides/custom-names`, { headers }),
        fetch(`${BACKEND_URL}/api/spirit-guides/access`, { headers }),
      ]);
      if (namesRes.ok) {
        const data = await namesRes.json();
        setCustomNames({
          male: data.male_name || 'Male Guide',
          female: data.female_name || 'Female Guide',
        });
      }
      if (accessRes.ok) {
        const data = await accessRes.json();
        // When the admin is using the dev "Preview as Free" toggle, ignore
        // both the Custom launch promo and Pride Month — show the world as a
        // permanently non-paying user would see it (all paywalls visible).
        if (previewAsFree) {
          setCustomUnlocked(false);
          setDivineUnlocked(false);
          setInFreePromo(false);
          setPrideMonth(false);
        } else {
          setCustomUnlocked(!!data.custom_unlocked);
          setDivineUnlocked(!!data.divine_unlocked);
          setInFreePromo(!!data.in_free_promo);
          setPrideMonth(!!data.pride_month);
        }
      }
    } catch (e) {
      console.warn('Failed to load custom guide info', e);
    }
  };

  const openRenameModal = (slot: 'male' | 'female') => {
    if (!customUnlocked) {
      setShowPaywall(true);
      return;
    }
    setRenameInput(slot === 'male' ? customNames.male : customNames.female);
    setRenameModal(slot);
  };

  const saveCustomName = async () => {
    if (!renameModal) return;
    const trimmed = (renameInput || '').trim().slice(0, 32);
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name for your guide.');
      return;
    }
    setRenameSaving(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const body: any = {};
      if (renameModal === 'male') {
        body.male_name = trimmed;
        body.female_name = customNames.female;
      } else {
        body.male_name = customNames.male;
        body.female_name = trimmed;
      }
      const res = await fetch(`${BACKEND_URL}/api/spirit-guides/custom-names`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        Alert.alert('Sign in required', 'Please sign in to customize your guides.');
        setRenameModal(null);
        return;
      }
      if (res.status === 403) {
        setRenameModal(null);
        setShowPaywall(true);
        return;
      }
      if (!res.ok) throw new Error('save failed');
      const data = await res.json();
      setCustomNames({
        male: data.male_name || 'Male Guide',
        female: data.female_name || 'Female Guide',
      });
      setRenameModal(null);
    } catch (e) {
      console.warn('Rename failed', e);
      Alert.alert('Couldn’t save', 'Please try again in a moment.');
    } finally {
      setRenameSaving(false);
    }
  };

  // Build the displayed Custom Guides list with the current renames applied
  const customGuides: Guide[] = customGuidesBase.map((g) =>
    g.custom_slot === 'male'
      ? { ...g, name: customNames.male }
      : { ...g, name: customNames.female }
  );



  const checkBirthdayStored = async () => {
    try {
      // Don't auto-popup the birthday picker when entering Spirit Guides.
      // Users can tap the "Enter birthday for guide pairing" link if they
      // want to get a paired suggestion.
      // (Previously this would force-open the modal when no birthday was stored.)
      return;
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

  // Greetings in all supported languages
  const getGreeting = (guideName: string, element: string, lang: string): string => {
    const greetings: Record<string, string> = {
      en: `Greetings, seeker. I am ${guideName}, guide of ${element}. How may I illuminate your path?`,
      es: `Saludos, buscador. Soy ${guideName}, guía del ${element}. ¿Cómo puedo iluminar tu camino?`,
      fr: `Salutations, chercheur. Je suis ${guideName}, guide de ${element}. Comment puis-je éclairer votre chemin?`,
      de: `Grüße, Suchender. Ich bin ${guideName}, Führer des ${element}. Wie kann ich deinen Weg erhellen?`,
      it: `Saluti, cercatore. Sono ${guideName}, guida del ${element}. Come posso illuminare il tuo cammino?`,
      pt: `Saudações, buscador. Eu sou ${guideName}, guia do ${element}. Como posso iluminar seu caminho?`,
      ja: `ご挨拶申し上げます、探求者よ。私は${guideName}、${element}の導き手です。あなたの道をどのように照らしましょうか？`,
      ko: `인사드립니다, 탐구자여. 저는 ${element}의 안내자 ${guideName}입니다. 어떻게 당신의 길을 밝혀드릴까요?`,
      zh: `问候，寻道者。我是${guideName}，${element}的引导者。我该如何照亮你的道路？`,
    };
    return greetings[lang] || greetings.en;
  };

  // Element names in different languages
  const getElementName = (element: string, lang: string): string => {
    const elements: Record<string, Record<string, string>> = {
      Fire: { en: 'Fire', es: 'Fuego', fr: 'Feu', de: 'Feuer', it: 'Fuoco', pt: 'Fogo', ja: '火', ko: '불', zh: '火' },
      Water: { en: 'Water', es: 'Agua', fr: 'Eau', de: 'Wasser', it: 'Acqua', pt: 'Água', ja: '水', ko: '물', zh: '水' },
      Earth: { en: 'Earth', es: 'Tierra', fr: 'Terre', de: 'Erde', it: 'Terra', pt: 'Terra', ja: '地', ko: '땅', zh: '土' },
      Air: { en: 'Air', es: 'Aire', fr: 'Air', de: 'Luft', it: 'Aria', pt: 'Ar', ja: '風', ko: '공기', zh: '风' },
    };
    return elements[element]?.[lang] || elements[element]?.en || element;
  };

  const selectGuide = async (guide: Guide, opts?: { divinePair?: boolean }) => {
    setSelectedGuide(guide);
    setAudioError(null);

    // Special path: Divine Pair mode → fetch a two-part intro (Helios + Selene each
    // introduce themselves with their own voice). The caller passes opts.divinePair=true
    // because the divinePairMode state setter is async and hasn't applied yet.
    const isPair = opts?.divinePair ?? divinePairMode;
    if (isPair) {
      try {
        const token = await AsyncStorage.getItem('session_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(
          `${BACKEND_URL}/api/spirit-guides/divine-intro?lang=${encodeURIComponent(languageCode)}`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.messages?.length) {
            const introMsgs: Message[] = data.messages.map((m: any) => ({
              role: 'assistant',
              content: `${m.guide}: ${m.text}`,
              hasAudio: !!m.audio_base64,
              audioBase64: m.audio_base64 || undefined,
            }));
            setMessages(introMsgs);
            // Prefer the server-concatenated seamless clip (both voices baked into one
            // MP3) so the player never has to unload/reload between Helios and Selene.
            // Falls back to per-message playback chain if combined clip isn't available.
            if (!isMuted) {
              await new Promise((r) => setTimeout(r, 80));
              if (data.combined_audio_base64) {
                // Single clip — true zero-gap transition. Both bubbles stay highlighted
                // collectively; advanced highlight switching could be added later.
                await playAudioAndWait(data.combined_audio_base64, 0, 0);
              } else {
                for (let i = 0; i < introMsgs.length; i++) {
                  const audio = introMsgs[i].audioBase64;
                  if (!audio) continue;
                  // eslint-disable-next-line no-await-in-loop
                  await playAudioAndWait(audio, i, 120);
                }
              }
            }
            return;
          }
        }
      } catch (e) {
        console.warn('Divine intro fetch failed, falling back:', e);
      }
      // Fallback to generic greeting if the endpoint failed
    }

    const elementName = getElementName(guide.element, languageCode);
    const greeting = getGreeting(guide.name, elementName, languageCode);
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
          language: languageCode,
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

  /**
   * Plays an audio clip and resolves the promise when playback finishes (or fails).
   * Used by the Divine Pair flow to chain Helios → Selene → Unified seamlessly.
   * Honors a short inter-clip gap to give the dialogue a natural breath between speakers.
   */
  const playAudioAndWait = (audioBase64: string, messageIndex: number, gapMs = 350): Promise<void> => {
    return new Promise(async (resolve) => {
      if (isMuted) {
        resolve();
        return;
      }
      if (!audioBase64 || audioBase64.length < 100) {
        resolve();
        return;
      }
      try {
        if (audioPlayerRef.current) {
          await audioPlayerRef.current.unload();
        }
        const player = new AudioPlayerManager();
        const audioUri = `data:audio/mpeg;base64,${audioBase64}`;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          setPlayingAudioIndex(null);
          setTimeout(resolve, gapMs);
        };
        player.onPlaybackStatusChange((status) => {
          if (status.didJustFinish) {
            finish();
          }
        });
        await player.loadAndPlay(audioUri);
        audioPlayerRef.current = player;
        setPlayingAudioIndex(messageIndex);
        // Fail-safe — if no callback fires in 60s, resolve anyway so chat doesn't hang
        setTimeout(finish, 60_000);
      } catch (error) {
        console.error('playAudioAndWait error:', error);
        setPlayingAudioIndex(null);
        resolve();
      }
    });
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedGuide) return;

    const userMessage: Message = { role: 'user', content: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Special path: Divine Pair mode → call /chat-pair which returns 3 sequenced messages
      if (divinePairMode) {
        const token = await AsyncStorage.getItem('session_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${BACKEND_URL}/api/spirit-guides/chat-pair`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: inputText,
            history: messages,
            language: languageCode,
          }),
        });
        if (response.status === 401) {
          Alert.alert('Sign in required', 'Please sign in to commune with the Divine pair.');
          setLoading(false);
          return;
        }
        if (response.status === 403) {
          setShowPaywall(true);
          setLoading(false);
          return;
        }
        const data = await response.json();
        if (!data.success || !data.messages) {
          throw new Error('Pair chat failed');
        }
        // Append each pair message as a separate assistant message
        const pairMsgs: Message[] = data.messages.map((m: any) => ({
          role: 'assistant',
          content: `${m.guide}: ${m.text}`,
          hasAudio: !!m.audio_base64,
          audioBase64: m.audio_base64 || undefined,
        }));
        // Capture the index where the new messages will land so we can highlight each as it plays.
        const startIndex = messages.length + 1; // +1 for the user message we just appended
        setMessages((prev) => [...prev, ...pairMsgs]);
        setLoading(false);

        // Chain audio playback so the dialogue feels unbroken:
        //   Helios → Selene → Unified blessing.
        // PREFER the single combined MP3 stream (raw byte-concat of all 3 clips
        // returned by the backend) — playing one continuous clip eliminates the
        // dead-air gap and the accidental overlap that can occur when chaining
        // three separate audio loads.
        if (!isMuted) {
          // Small pre-roll so the UI has a moment to render the bubbles
          await new Promise((r) => setTimeout(r, 80));
          if (data.combined_audio_base64) {
            // Single seamless clip — highlight Helios bubble first; we don't
            // currently know precise timestamps so we keep one highlight active
            // for the whole duration (acceptable since the audio plays as one).
            await playAudioAndWait(data.combined_audio_base64, startIndex, 0);
          } else {
            // Fallback: chain the three clips individually
            for (let i = 0; i < pairMsgs.length; i++) {
              const audio = pairMsgs[i].audioBase64;
              if (!audio) continue;
              const gap = i === pairMsgs.length - 1 ? 400 : 120;
              // eslint-disable-next-line no-await-in-loop
              await playAudioAndWait(audio, startIndex + i, gap);
            }
          }
        }
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/spirit-guides/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide: selectedGuide.name,
          element: selectedGuide.element,
          message: inputText,
          history: messages,
          language: languageCode,
          voice_id: selectedGuide.voice_id,
          gender: selectedGuide.gender,
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

  const saveChatToJournal = async () => {
    if (!selectedGuide || messages.length === 0) {
      Alert.alert('No Chat', 'Start a conversation first before saving to journal.');
      return;
    }

    try {
      const chatContent = messages.map(msg => 
        `${msg.role === 'user' ? 'You' : selectedGuide.name}: ${msg.content}`
      ).join('\n\n');

      const journalEntry = {
        title: `Spirit Guide Chat: ${selectedGuide.name}`,
        content: `Guide: ${selectedGuide.name} (${selectedGuide.element})\nDate: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}\n\n${chatContent}`,
        category: 'spirit_guide',
        entry_type: 'transcript',
        date: new Date().toISOString(),
        metadata: {
          guide_name: selectedGuide.name,
          guide_element: selectedGuide.element,
          messages_count: messages.length,
          chat_date: new Date().toISOString(),
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
        // Spirit Guide acknowledges the save with a personalized message
        const acknowledgments: { [key: string]: string } = {
          'Fire': `Our conversation has been preserved in your journal, like embers kept warm for reflection. May these words ignite your path when you revisit them. 🔥`,
          'Water': `I have gently placed our exchange into your journal's waters. Return to it whenever you need to flow with these insights again. 💧`,
          'Earth': `Our wisdom has been grounded in your journal, planted like seeds for future growth. May it nourish your journey ahead. 🌿`,
          'Air': `Our words have been carried into your journal on the wind. They await you there, ready to inspire new thoughts whenever you return. 💨`,
        };
        
        const guideAcknowledgment = acknowledgments[selectedGuide.element] || 
          `Our conversation has been saved to your journal. Return to it whenever you seek guidance from our exchange.`;
        
        // Add the acknowledgment as a new message from the guide
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: guideAcknowledgment,
          hasAudio: false,
        }]);
        
        // Scroll to show the new message
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Could not save to journal. Please try again.');
      }
    } catch (error) {
      console.error('Error saving to journal:', error);
      Alert.alert('Error', 'Could not save to journal. Please try again.');
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
      <BirthdayPicker
        birthMonth={birthMonth}
        birthDay={birthDay}
        onChangeMonth={setBirthMonth}
        onChangeDay={setBirthDay}
        onSubmit={submitBirthday}
        onSkip={() => setShowBirthdayInput(false)}
      />
    );
  }

  if (!selectedGuide) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1a0033', '#0d0015', '#000000']} style={StyleSheet.absoluteFill} />
        <Mist count={6} intensity="soft" />

        <ScrollView contentContainerStyle={styles.selectionContainer}>
          {/* Hero Section with Image Background */}
          <View style={styles.heroSection}>
            <ExpoImage source={{ uri: SPIRIT_GUIDES_HERO_IMAGE }} style={styles.heroImage} contentFit="cover" />
            <LinearGradient
              colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.55)', 'rgba(13,0,21,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroEyebrow}>✦ Elemental Spirits ✦</Text>
              <Text style={styles.heroTitle}>Spirit Guides</Text>
              <View style={styles.heroGlyphRow}>
                <View style={styles.heroGlyphLine} />
                <Ionicons name="sparkles" size={11} color={palette.gold} style={{ marginHorizontal: 8 }} />
                <View style={styles.heroGlyphLine} />
              </View>
              <Text style={styles.heroSubtitle}>Select your guide</Text>
            </View>
          </View>
          
          {/* Enter/Update Birthday Link */}
          <TouchableOpacity 
            style={styles.enterBirthdayButton}
            onPress={() => {
              setBirthMonth('');
              setBirthDay('');
              setShowBirthdayInput(true);
            }}
          >
            <Ionicons name="calendar" size={16} color="#b794f6" />
            <Text style={styles.enterBirthdayText}>
              {suggestedGuide ? 'Update birthday' : 'Enter birthday for guide pairing'}
            </Text>
          </TouchableOpacity>

          {suggestedGuide && (
            <View style={styles.suggestedCard}>
              <Ionicons name="star" size={24} color="#f59e0b" />
              <Text style={styles.suggestedText}>
                Based on your zodiac, we recommend {suggestedGuide.name} ({suggestedGuide.element})
              </Text>
            </View>
          )}

          <View style={styles.guidesGrid}>
            <Text style={styles.sectionHeading}>Elemental Guides</Text>
            <Text style={styles.sectionSub}>Matched to your zodiac element</Text>
            {elementalGuides.map((guide) => (
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
                    <Image source={guide.image} style={styles.guideImage} resizeMode="cover" />
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

            <View style={styles.sectionDivider} />
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeading}>LGBTQ+ Guides</Text>
              <View style={styles.rainbowDot} />
              {prideMonth ? (
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>FREE THRU JUNE</Text>
                </View>
              ) : !isPremium ? (
                <SubscriptionOnlyBanner variant="badge" style={{ marginLeft: 6 }} />
              ) : null}
            </View>
            <Text style={styles.sectionSub}>
              {prideMonth
                ? 'Open to every seeker — free through June (Pride Month)'
                : 'Affirming companions through pride, self-love, and authenticity'}
            </Text>
            {lgbtqGuides.map((guide) => (
              <TouchableOpacity
                key={guide.name}
                style={styles.guideCard}
                onPress={() => {
                  // Free for everyone during the June Pride Month promo; otherwise
                  // requires an active subscription.
                  if (!prideMonth && !isPremium) {
                    setShowPaywall(true);
                    return;
                  }
                  selectGuide(guide);
                }}
                activeOpacity={0.7}
              >
                {guide.image ? (
                  <View style={[styles.guideImageContainer, { borderColor: guide.color }]}>
                    <Image source={guide.image} style={styles.guideImage} resizeMode="cover" />
                  </View>
                ) : (
                  <View style={[styles.guideIcon, { backgroundColor: guide.color }]}>
                    <Ionicons name={guide.icon as any} size={40} color="#fff" />
                  </View>
                )}
                <Text style={styles.guideName}>{guide.name}</Text>
                <Text style={styles.guideElement}>{guide.element}</Text>
                <Text style={styles.guideGender}>
                  {guide.genderSymbol || (guide.gender === 'transgender' ? '⚧' : guide.gender === 'non-binary' ? '⚧' : guide.gender === 'feminine' ? '♀' : '♂')} {guide.gender}
                </Text>
                <Text style={styles.guideDescription}>{guide.description}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.sectionDivider} />
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeading}>Custom Guides</Text>
              {!customUnlocked && (
                <SubscriptionOnlyBanner variant="badge" style={{ marginLeft: 6 }} />
              )}
            </View>
            <Text style={styles.sectionSub}>
              {customUnlocked
                ? 'Tap the pencil to give your guide a name'
                : 'Personal companions — name them, befriend them, walk with them'}
            </Text>
            {customGuides.map((guide) => (
              <TouchableOpacity
                key={guide.custom_slot}
                style={styles.guideCard}
                onPress={() => selectGuide(guide)}
                activeOpacity={0.7}
              >
                {guide.image ? (
                  <View style={[styles.guideImageContainer, { borderColor: '#fbbf24' }]}>
                    <Image source={guide.image} style={styles.guideImage} resizeMode="cover" />
                  </View>
                ) : (
                  <View style={[styles.guideIcon, { backgroundColor: guide.color }]}>
                    <Ionicons name={guide.icon as any} size={40} color="#fff" />
                  </View>
                )}
                <View style={styles.customNameRow}>
                  <Text style={styles.guideName}>{guide.name}</Text>
                  <TouchableOpacity
                    style={styles.renameButton}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      openRenameModal(guide.custom_slot as 'male' | 'female');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="pencil" size={14} color="#fbbf24" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.guideElement}>Custom</Text>
                <Text style={styles.guideGender}>
                  {guide.gender === 'feminine' ? '♀' : '♂'} {guide.gender}
                </Text>
                <Text style={styles.guideDescription}>{guide.description}</Text>
                {!customUnlocked && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={20} color="#fbbf24" />
                    <Text style={styles.lockText}>Premium</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <View style={styles.sectionDivider} />
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeading}>Divine Guides</Text>
              <View style={styles.divineDot} />
              {!divineUnlocked && (
                <SubscriptionOnlyBanner variant="badge" style={{ marginLeft: 6 }} />
              )}
            </View>
            <Text style={styles.sectionSub}>
              {divineUnlocked
                ? 'Helios & Selene — Sacred Masculine and Sacred Feminine'
                : 'Commune with the Divine Pair — Helios & Selene'}
            </Text>
            {divineGuides.map((guide) => (
              <TouchableOpacity
                key={guide.name}
                style={styles.guideCard}
                onPress={() => {
                  if (!divineUnlocked) {
                    setShowPaywall(true);
                    return;
                  }
                  setDivinePairMode(false);
                  selectGuide(guide);
                }}
                activeOpacity={0.7}
              >
                {guide.image ? (
                  <View style={[styles.guideImageContainer, { borderColor: guide.color }]}>
                    <Image source={guide.image} style={styles.guideImage} resizeMode="cover" />
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
                {!divineUnlocked && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={20} color="#fbbf24" />
                    <Text style={styles.lockText}>Premium</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.talkBothBtn, !divineUnlocked && styles.talkBothBtnLocked]}
              onPress={() => {
                if (!divineUnlocked) {
                  setShowPaywall(true);
                  return;
                }
                setDivinePairMode(true);
                // Use Helios as the primary "selectedGuide" so the chat UI mounts.
                // Pass divinePair:true explicitly because the state setter above is
                // async — selectGuide would otherwise see divinePairMode === false.
                selectGuide({
                  ...divineGuides[0],
                  name: 'Helios & Selene',
                  description: 'Divine Pair — Sacred Union',
                  // Alternating gold (Helios — sun) + silver (Selene — moon) rings
                  // pulse around the avatar while the pair speaks together.
                  ringColors: ['#fbbf24', '#e5e7eb', '#fbbf24', '#e5e7eb', '#fbbf24'],
                }, { divinePair: true });
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={18} color="#1a0033" />
              <Text style={styles.talkBothBtnText}>Talk to Both Together</Text>
              {!divineUnlocked && <Ionicons name="lock-closed" size={14} color="#1a0033" style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Rename modal for Custom Guides */}
        <RenameModal
          visible={renameModal !== null}
          slot={renameModal}
          input={renameInput}
          onChangeInput={setRenameInput}
          saving={renameSaving}
          onSave={saveCustomName}
          onClose={() => setRenameModal(null)}
        />

        <Paywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="Custom Spirit Guides"
        />
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
            setDivinePairMode(false);
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        
        {/* Guide Picture in Header with Pulsating Ring */}
        <View style={styles.chatHeaderImageWrapper}>
          {/* Animated pulsating ring(s) */}
          {isTalking && selectedGuide.ringColors && selectedGuide.ringColors.length > 0 ? (
            selectedGuide.ringColors.map((c, idx) => {
              const sizeBoost = idx * 6; // each ring 6px larger
              return (
                <Animated.View
                  key={`ring-${idx}`}
                  style={[
                    styles.pulseRing,
                    {
                      width: 56 + sizeBoost,
                      height: 56 + sizeBoost,
                      borderRadius: (56 + sizeBoost) / 2,
                      borderColor: c,
                      transform: [{ scale: pulseAnim }],
                      opacity: glowAnim,
                    },
                  ]}
                />
              );
            })
          ) : isTalking ? (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  borderColor: selectedGuide.color,
                  transform: [{ scale: pulseAnim }],
                  opacity: glowAnim,
                },
              ]}
            />
          ) : null}
          {selectedGuide.image ? (
            <View style={[
              styles.chatHeaderImageContainer,
              isTalking && { borderColor: selectedGuide.color }
            ]}>
              <Image 
                source={selectedGuide.image} 
                style={styles.chatHeaderImage}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={[styles.chatHeaderIcon, { backgroundColor: selectedGuide.color }]}>
              <Ionicons name={selectedGuide.icon as any} size={24} color="#fff" />
            </View>
          )}
        </View>
        
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{selectedGuide.name}</Text>
          <Text style={styles.chatHeaderElement}>
            {divinePairMode
              ? 'Guides of the Sun and Moon'
              : `Guide of ${selectedGuide.element} • ${selectedGuide.gender}`}
          </Text>
        </View>
        <View style={styles.chatHeaderRight}>
          {/* Save to Journal Button */}
          <TouchableOpacity
            style={styles.saveJournalButton}
            onPress={saveChatToJournal}
          >
            <Ionicons name="book" size={18} color="#10b981" />
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
        </View>
      </View>
      
      {/* Switch Guide Button - Centered below header */}
      <View style={styles.switchButtonContainer}>
        <TouchableOpacity
          style={styles.switchGuideButton}
          onPress={() => {
            setSelectedGuide(null);
            setMessages([]);
          }}
        >
          <Ionicons name="people" size={16} color="#b794f6" />
          <Text style={styles.switchGuideText}>Switch Guide</Text>
        </TouchableOpacity>
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

