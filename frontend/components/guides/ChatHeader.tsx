/**
 * ChatHeader — animated avatar (pulsating rings while talking), guide name,
 * subtitle, and right-side actions (save-to-journal + mute toggle +
 * switch-guide chip).
 *
 * Restored the original animated hero image + aura pulse rings after they
 * were briefly removed. The mute button is kept. A compact "Switch Guide"
 * chip is added on the right so the parent screen can drop its floating
 * pill that used to overlap the guide name.
 */
import React from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Guide } from '../../constants/guides';
import { styles } from './styles';

interface ChatHeaderProps {
  selectedGuide: Guide;
  divinePairMode: boolean;
  isTalking: boolean;
  isMuted: boolean;
  pulseAnim: Animated.Value;
  glowAnim: Animated.Value;
  onBack: () => void;
  onToggleMute: () => void;
  onSaveJournal: () => void;
  /** Optional — when provided, renders a compact people-icon chip that
   *  swaps the current guide (replaces the floating "Switch Guide" pill
   *  that used to overlap the header). */
  onSwitchGuide?: () => void;
}

export default function ChatHeader({
  selectedGuide,
  divinePairMode,
  isTalking,
  isMuted,
  pulseAnim,
  glowAnim,
  onBack,
  onToggleMute,
  onSaveJournal,
  onSwitchGuide,
}: ChatHeaderProps) {
  return (
    <View style={styles.chatHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
      </TouchableOpacity>

      {/* Avatar with pulsating ring(s) */}
      <View style={styles.chatHeaderImageWrapper}>
        {isTalking && selectedGuide.ringColors && selectedGuide.ringColors.length > 0 ? (
          selectedGuide.ringColors.map((c, idx) => {
            const sizeBoost = idx * 6;
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
          <View
            style={[
              styles.chatHeaderImageContainer,
              isTalking && { borderColor: selectedGuide.color },
            ]}
          >
            <Image source={selectedGuide.image} style={styles.chatHeaderImage} resizeMode="cover" />
          </View>
        ) : (
          <View style={[styles.chatHeaderIcon, { backgroundColor: selectedGuide.color }]}>
            <Ionicons name={selectedGuide.icon as any} size={24} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.chatHeaderInfo}>
        <Text style={styles.chatHeaderName} numberOfLines={1}>
          {selectedGuide.name}
        </Text>
        <Text style={styles.chatHeaderElement} numberOfLines={1}>
          {divinePairMode
            ? 'Guides of the Sun and Moon'
            : selectedGuide.category === 'custom'
            ? `Your personal companion • ${selectedGuide.gender}`
            : `Guide of ${selectedGuide.element} • ${selectedGuide.gender}`}
        </Text>
      </View>

      <View style={styles.chatHeaderRight}>
        <TouchableOpacity style={styles.saveJournalButton} onPress={onSaveJournal}>
          <Ionicons name="book" size={18} color="#10b981" />
        </TouchableOpacity>
        {onSwitchGuide ? (
          <TouchableOpacity
            style={styles.switchGuideChip}
            onPress={onSwitchGuide}
            accessibilityLabel="Switch Guide"
          >
            <Ionicons name="people" size={18} color="#b794f6" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.muteButton, isMuted && styles.muteButtonActive]}
          onPress={onToggleMute}
        >
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={20}
            color={isMuted ? '#ef4444' : '#b794f6'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
