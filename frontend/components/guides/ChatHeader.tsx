/**
 * ChatHeader — guide name, subtitle, and right-side actions
 * (save-to-journal + mute toggle). The animated pulse rings and hero
 * image were removed per user request (2026-08-05, brought in from GitHub);
 * we now show a simple colored icon-circle avatar instead.
 *
 * `pulseAnim` and `glowAnim` remain accepted as optional props for
 * backwards compatibility with the spirit-guides screen — they are
 * currently unused inside this component.
 */
import React from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Guide } from '../../constants/guides';
import { styles } from './styles';

interface ChatHeaderProps {
  selectedGuide: Guide;
  divinePairMode: boolean;
  isTalking: boolean;
  isMuted: boolean;
  onBack: () => void;
  onToggleMute: () => void;
  onSaveJournal: () => void;
  /** No longer used; retained so callers do not need to change. */
  pulseAnim?: Animated.Value;
  /** No longer used; retained so callers do not need to change. */
  glowAnim?: Animated.Value;
}

export default function ChatHeader({
  selectedGuide,
  divinePairMode,
  isMuted,
  onBack,
  onToggleMute,
  onSaveJournal,
}: ChatHeaderProps) {
  return (
    <View style={styles.chatHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
      </TouchableOpacity>

      {/* Simplified avatar: colored icon-circle (no animated rings, no hero image) */}
      <View style={styles.chatHeaderImageWrapper}>
        <View style={[styles.chatHeaderIcon, { backgroundColor: selectedGuide.color }]}>
          <Ionicons name={selectedGuide.icon as any} size={24} color="#fff" />
        </View>
      </View>

      <View style={styles.chatHeaderInfo}>
        <Text style={styles.chatHeaderName}>{selectedGuide.name}</Text>
        <Text style={styles.chatHeaderElement}>
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
