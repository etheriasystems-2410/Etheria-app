/**
 * ChatHeader — animated avatar (pulsating rings while talking), guide name,
 * subtitle, and right-side actions (save-to-journal + mute toggle).
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
        <Text style={styles.chatHeaderName}>{selectedGuide.name}</Text>
        <Text style={styles.chatHeaderElement}>
          {divinePairMode
            ? 'Guides of the Sun and Moon'
            : `Guide of ${selectedGuide.element} • ${selectedGuide.gender}`}
        </Text>
      </View>

      <View style={styles.chatHeaderRight}>
        <TouchableOpacity style={styles.saveJournalButton} onPress={onSaveJournal}>
          <Ionicons name="book" size={18} color="#10b981" />
        </TouchableOpacity>
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
