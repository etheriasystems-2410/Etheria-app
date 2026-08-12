/**
 * ChatView — the Spirit-Guides conversation screen (header + banners +
 * message list + suggested prompts + composer + breathing guide-portrait
 * background). Extracted from `spirit-guides.tsx` (previously ~1069 lines)
 * so the parent screen stays focused on data / navigation orchestration.
 *
 * All state lives in the parent — this is a pure presentational component
 * that receives everything it needs through props.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image as RNImage,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Guide, Message } from '../../constants/guides';
import ChatHeader from './ChatHeader';
import { styles } from './styles';

type SpiritAudio = {
  isTalking: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  pulseAnim: Animated.Value;
  glowAnim: Animated.Value;
  playingAudioIndex: number | null;
  audioError: string | null;
  generatingAudio: boolean;
};

interface ChatViewProps {
  selectedGuide: Guide;
  divinePairMode: boolean;
  messages: Message[];
  loading: boolean;
  inputText: string;
  setInputText: (v: string) => void;
  sendMessage: () => void;
  replayAudio: (message: Message, index: number) => void;
  onBack: () => void;
  onSwitchGuide: () => void;
  onSaveJournal: () => void;
  audio: SpiritAudio;
  bottomPad: number;
  /** Optional list of suggested opener prompts, shown while the
   *  conversation is empty. When omitted, a sensible default list is used. */
  suggestedPrompts?: string[];
}

export default function ChatView({
  selectedGuide,
  divinePairMode,
  messages,
  loading,
  inputText,
  setInputText,
  sendMessage,
  replayAudio,
  onBack,
  onSwitchGuide,
  onSaveJournal,
  audio,
  bottomPad,
  suggestedPrompts,
}: ChatViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // ── Guide-portrait "breathing" background animation ──────────────────
  const bgPulse = useRef(new Animated.Value(0)).current;
  const guideIsActive = loading || audio.isTalking;

  useEffect(() => {
    if (!guideIsActive) {
      bgPulse.stopAnimation();
      Animated.timing(bgPulse, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bgPulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bgPulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [guideIsActive, bgPulse]);

  const bgScale = bgPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const bgOpacity = bgPulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.42] });

  const prompts = useMemo(
    () =>
      suggestedPrompts && suggestedPrompts.length > 0
        ? suggestedPrompts
        : [
            'What message do you have for me today?',
            'How can I raise my vibration?',
            'What lesson is this moment offering me?',
            'What sign should I look out for?',
            'What is blocking my growth right now?',
          ],
    [suggestedPrompts],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Guide portrait as breathing background. Gently scales + brightens
          while the guide is thinking / speaking; softly dims when idle. */}
      {selectedGuide?.image ? (
        <Animated.View
          pointerEvents="none"
          style={[
            chatBgStyles.bgLayer,
            { opacity: bgOpacity, transform: [{ scale: bgScale }] },
          ]}
        >
          <RNImage source={selectedGuide.image} style={chatBgStyles.bgImage} resizeMode="cover" />
        </Animated.View>
      ) : null}
      <View pointerEvents="none" style={chatBgStyles.bgScrim} />

      <ChatHeader
        selectedGuide={selectedGuide}
        divinePairMode={divinePairMode}
        isTalking={audio.isTalking}
        isMuted={audio.isMuted}
        pulseAnim={audio.pulseAnim}
        glowAnim={audio.glowAnim}
        onBack={onBack}
        onToggleMute={audio.toggleMute}
        onSaveJournal={onSaveJournal}
        onSwitchGuide={onSwitchGuide}
      />

      {/* Audio Status Banners */}
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
        contentContainerStyle={[styles.messagesContent, { paddingBottom: bottomPad }]}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
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
                message.role === 'user'
                  ? styles.userMessageText
                  : styles.assistantMessageText,
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

        {/* Suggested-prompt chips shown while the chat is empty. */}
        {messages.length <= 1 && !loading ? (
          <View style={styles.suggestedPromptsWrap}>
            <Text style={styles.suggestedPromptsLabel}>✨ Try asking me…</Text>
            <View style={styles.suggestedPromptRow}>
              {prompts.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.suggestedPromptChip}
                  onPress={() => setInputText(prompt)}
                >
                  <Ionicons name="sparkles" size={12} color="#b794f6" />
                  <Text style={styles.suggestedPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

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

// Chat-background image + scrim styles kept local so they don't leak into
// the shared guides stylesheet.
const chatBgStyles = StyleSheet.create({
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    zIndex: -2,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  bgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,0,24,0.55)',
    zIndex: -1,
  },
});
