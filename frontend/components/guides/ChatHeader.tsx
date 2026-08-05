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
  onBack: () => void;
  onToggleMute: () => void;
  onSaveJournal: () => void;
}

export default function ChatHeader({
  selectedGuide,
  divinePairMode,
  isTalking,
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

      {/* Simplified avatar: remove animated rings and small hero image per request */}
      <View style={styles.chatHeaderImageWrapper}>
        {/* Render a colored circle (icon) instead of the hero image */}
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
