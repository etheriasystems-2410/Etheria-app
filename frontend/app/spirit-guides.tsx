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
  Alert,
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
import { setupAudioMode } from '../utils/audioPlayer';
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
import GuideCard from '../components/guides/GuideCard';
import ChatHeader from '../components/guides/ChatHeader';
import { useSpiritGuideAudio } from '../hooks/useSpiritGuideAudio';

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
  const scrollViewRef = useRef<ScrollView>(null);

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

  // Check if user has access to Spirit Guides feature
  const hasAccess = isPremium || checkFeatureAccess('spirit_guides');

  // All audio + animation state lives in the dedicated hook.
  const audio = useSpiritGuideAudio({ chatLoading: loading, selectedGuide });

  useEffect(() => {
    if (hasAccess) {
      checkBirthdayStored();
      setupAudioMode();
      loadCustomGuideInfo();
    }
  }, [hasAccess, previewAsFree]);

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
    // Don't auto-popup the birthday picker when entering Spirit Guides.
    // Users can tap the "Enter birthday for guide pairing" link if they want
    // to get a paired suggestion.
    return;
  };

  const submitBirthday = async () => {
    const month = parseInt(birthMonth);
    const day = parseInt(birthDay);
    if (month < 1 || month > 12 || day < 1 || day > 31) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/zodiac/element/${month}/${day}`);
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
        selectGuide(matchedGuide);
      }
      setShowBirthdayInput(false);
    } catch (error) {
      console.error('Error submitting birthday:', error);
    }
  };

  // Greetings in all supported languages (kept short to save TTS credits)
  const getGreeting = (guideName: string, element: string, lang: string, isCustom: boolean = false): string => {
    if (isCustom) {
      // Custom guides aren't "guides of [element]" — they're the user's PERSONAL
      // companions. The greeting reflects that intimate relationship.
      const customGreetings: Record<string, string> = {
        en: `Greetings, dear one. I am ${guideName}, your companion. How may I walk beside you?`,
        es: `Saludos, querido. Soy ${guideName}, tu compañero. ¿Cómo puedo caminar a tu lado?`,
        fr: `Salutations, cher ami. Je suis ${guideName}, ton compagnon. Comment puis-je marcher à tes côtés?`,
        de: `Grüße, mein Lieber. Ich bin ${guideName}, dein Begleiter. Wie kann ich an deiner Seite gehen?`,
        it: `Saluti, caro. Sono ${guideName}, il tuo compagno. Come posso camminare al tuo fianco?`,
        pt: `Saudações, querido. Eu sou ${guideName}, seu companheiro. Como posso caminhar ao seu lado?`,
        ja: `親愛なる方、私は${guideName}、あなたの伴侶です。どのように寄り添いましょうか？`,
        ko: `소중한 분이여, 저는 ${guideName}, 당신의 동반자입니다. 어떻게 곁을 걸어드릴까요?`,
        zh: `亲爱的，我是${guideName}，你的伴侣。我该如何陪伴你？`,
      };
      return customGreetings[lang] || customGreetings.en;
    }
    const greetings: Record<string, string> = {
      en: `Greetings, seeker. I am ${guideName}, guide of ${element}. How may I help?`,
      es: `Saludos, buscador. Soy ${guideName}, guía del ${element}. ¿Cómo puedo ayudar?`,
      fr: `Salutations, chercheur. Je suis ${guideName}, guide de ${element}. Comment puis-je aider?`,
      de: `Grüße, Suchender. Ich bin ${guideName}, Führer des ${element}. Wie kann ich helfen?`,
      it: `Saluti, cercatore. Sono ${guideName}, guida del ${element}. Come posso aiutare?`,
      pt: `Saudações, buscador. Eu sou ${guideName}, guia do ${element}. Como posso ajudar?`,
      ja: `探求者よ、私は${guideName}、${element}の導き手です。どうお助けしましょう？`,
      ko: `탐구자여, 저는 ${element}의 안내자 ${guideName}입니다. 어떻게 도와드릴까요?`,
      zh: `寻道者，我是${guideName}，${element}的引导者。我能如何帮助？`,
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
    audio.setAudioError(null);

    // Divine Pair → fetch two-part intro (Helios + Selene each introduce themselves).
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
            // Prefer the server-concatenated seamless clip so the player never has
            // to unload/reload between Helios and Selene. Falls back to per-message
            // chained playback if the combined clip isn't available.
            if (!audio.isMuted) {
              await new Promise((r) => setTimeout(r, 80));
              if (data.combined_audio_base64) {
                await audio.playAudioAndWait(data.combined_audio_base64, 0, 0);
              } else {
                for (let i = 0; i < introMsgs.length; i++) {
                  const a = introMsgs[i].audioBase64;
                  if (!a) continue;
                  // eslint-disable-next-line no-await-in-loop
                  await audio.playAudioAndWait(a, i, 120);
                }
              }
            }
            return;
          }
        }
      } catch (e) {
        console.warn('Divine intro fetch failed, falling back:', e);
      }
      // Fallback to generic greeting if endpoint failed
    }

    const elementName = getElementName(guide.element, languageCode);
    const isCustom = guide.category === 'custom';
    const greeting = getGreeting(guide.name, elementName, languageCode, isCustom);
    setMessages([{ role: 'assistant', content: greeting }]);

    // Auto-play greeting if not muted. Pass voice_id so the backend can route
    // renamed custom guides to the correct (gender-appropriate) voice instead
    // of falling back to the default Aether (feminine) voice.
    if (!audio.isMuted) {
      audio.generateAndPlayAudio(
        greeting,
        guide.name,
        languageCode,
        0,
        (audioBase64) => {
          setMessages((prev) =>
            prev.map((msg, idx) =>
              idx === 0 ? { ...msg, hasAudio: true, audioBase64 } : msg
            )
          );
        },
        guide.voice_id,
      );
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedGuide) return;

    const userMessage: Message = { role: 'user', content: inputText };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Divine Pair → /chat-pair returns Helios + Selene + unified blessing
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
        if (!data.success || !data.messages) throw new Error('Pair chat failed');

        const pairMsgs: Message[] = data.messages.map((m: any) => ({
          role: 'assistant',
          content: `${m.guide}: ${m.text}`,
          hasAudio: !!m.audio_base64,
          audioBase64: m.audio_base64 || undefined,
        }));
        const startIndex = messages.length + 1;
        setMessages((prev) => [...prev, ...pairMsgs]);
        setLoading(false);

        if (!audio.isMuted) {
          await new Promise((r) => setTimeout(r, 80));
          if (data.combined_audio_base64) {
            await audio.playAudioAndWait(data.combined_audio_base64, startIndex, 0);
          } else {
            for (let i = 0; i < pairMsgs.length; i++) {
              const a = pairMsgs[i].audioBase64;
              if (!a) continue;
              const gap = i === pairMsgs.length - 1 ? 400 : 120;
              // eslint-disable-next-line no-await-in-loop
              await audio.playAudioAndWait(a, startIndex + i, gap);
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

      if (!audio.isMuted && data.audio_base64) {
        const newMessageIndex = messages.length + 1;
        audio.playAudio(data.audio_base64, newMessageIndex);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const replayAudio = (message: Message, index: number) => {
    if (message.audioBase64) {
      audio.playAudio(message.audioBase64, index);
    }
  };

  const saveChatToJournal = async () => {
    if (!selectedGuide || messages.length === 0) {
      Alert.alert('No Chat', 'Start a conversation first before saving to journal.');
      return;
    }

    try {
      const chatContent = messages
        .map((msg) => `${msg.role === 'user' ? 'You' : selectedGuide.name}: ${msg.content}`)
        .join('\n\n');

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
        const acknowledgments: { [key: string]: string } = {
          Fire: `Our conversation has been preserved in your journal, like embers kept warm for reflection. May these words ignite your path when you revisit them. 🔥`,
          Water: `I have gently placed our exchange into your journal's waters. Return to it whenever you need to flow with these insights again. 💧`,
          Earth: `Our wisdom has been grounded in your journal, planted like seeds for future growth. May it nourish your journey ahead. 🌿`,
          Air: `Our words have been carried into your journal on the wind. They await you there, ready to inspire new thoughts whenever you return. 💨`,
        };
        const guideAcknowledgment =
          acknowledgments[selectedGuide.element] ||
          `Our conversation has been saved to your journal. Return to it whenever you seek guidance from our exchange.`;
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: guideAcknowledgment, hasAudio: false },
        ]);
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

  // ============= RENDER =============

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
          <TouchableOpacity style={styles.unlockButton} onPress={() => setShowPaywall(true)}>
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
          {/* Hero Section */}
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
            {/* Elemental */}
            <Text style={styles.sectionHeading}>Elemental Guides</Text>
            <Text style={styles.sectionSub}>Matched to your zodiac element</Text>
            {elementalGuides.map((guide) => (
              <GuideCard
                key={guide.name}
                guide={guide}
                isSuggested={suggestedGuide?.name === guide.name}
                onPress={() => selectGuide(guide)}
              />
            ))}

            {/* LGBTQ+ */}
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
              <GuideCard
                key={guide.name}
                guide={guide}
                borderColor={guide.color}
                onPress={() => {
                  // Free for everyone during June Pride Month; otherwise requires subscription.
                  if (!prideMonth && !isPremium) {
                    setShowPaywall(true);
                    return;
                  }
                  selectGuide(guide);
                }}
              />
            ))}

            {/* Custom */}
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
              <GuideCard
                key={guide.custom_slot}
                guide={guide}
                borderColor="#fbbf24"
                elementOverride="Custom"
                isLocked={!customUnlocked}
                onPress={() => selectGuide(guide)}
                extraOverlay={
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
                }
              />
            ))}

            {/* Divine */}
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
              <GuideCard
                key={guide.name}
                guide={guide}
                borderColor={guide.color}
                isLocked={!divineUnlocked}
                onPress={() => {
                  if (!divineUnlocked) {
                    setShowPaywall(true);
                    return;
                  }
                  setDivinePairMode(false);
                  selectGuide(guide);
                }}
              />
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
                selectGuide(
                  {
                    ...divineGuides[0],
                    name: 'Helios & Selene',
                    description: 'Divine Pair — Sacred Union',
                    // Alternating gold (Helios — sun) + silver (Selene — moon)
                    ringColors: ['#fbbf24', '#e5e7eb', '#fbbf24', '#e5e7eb', '#fbbf24'],
                  },
                  { divinePair: true }
                );
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

  // ============= CHAT VIEW =============
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ChatHeader
        selectedGuide={selectedGuide}
        divinePairMode={divinePairMode}
        isTalking={audio.isTalking}
        isMuted={audio.isMuted}
        pulseAnim={audio.pulseAnim}
        glowAnim={audio.glowAnim}
        onBack={() => {
          setSelectedGuide(null);
          setMessages([]);
          setDivinePairMode(false);
        }}
        onToggleMute={audio.toggleMute}
        onSaveJournal={saveChatToJournal}
      />

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
      {audio.audioError && (
        <View style={styles.audioErrorBanner}>
          <Ionicons name="volume-mute" size={16} color="#fbbf24" />
          <Text style={styles.audioErrorText}>{audio.audioError}</Text>
        </View>
      )}
      {audio.generatingAudio && (
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
                    audio.playingAudioIndex === index
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
