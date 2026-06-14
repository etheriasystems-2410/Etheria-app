/**
 * MeditationPlayer — the purple "Guided Meditation" block at the bottom of
 * each lesson. Wires Play/Stop buttons to a `useTrainingMeditation` instance
 * passed in by the parent.
 */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Lesson } from './types';

interface Props {
  meditation: NonNullable<Lesson['meditation']>;
  isPlayingMeditation: boolean;
  isGeneratingTTS: boolean;
  ttsProgress: string;
  onPlay: () => void;
  onStop: () => void;
}

export default function MeditationPlayer({
  meditation,
  isPlayingMeditation,
  isGeneratingTTS,
  ttsProgress,
  onPlay,
  onStop,
}: Props) {
  return (
    <View style={styles.meditationSection}>
      <View style={styles.meditationHeader}>
        <View style={styles.meditationIcon}>
          <Ionicons name="flower-outline" size={24} color="#a855f7" />
        </View>
        <View style={styles.meditationInfo}>
          <Text style={styles.meditationTitle}>{meditation.title}</Text>
          <Text style={styles.meditationDuration}>
            {meditation.duration} minutes
          </Text>
        </View>
      </View>

      <View style={styles.meditationControls}>
        {isGeneratingTTS ? (
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="small" color="#a855f7" />
            <Text style={styles.generatingText}>{ttsProgress}</Text>
          </View>
        ) : isPlayingMeditation ? (
          <TouchableOpacity style={styles.stopMeditationButton} onPress={onStop}>
            <Ionicons name="stop-circle" size={24} color="#ef4444" />
            <Text style={styles.stopMeditationText}>Stop Meditation</Text>
            {ttsProgress ? (
              <Text style={styles.progressText}>{ttsProgress}</Text>
            ) : null}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.playMeditationButton} onPress={onPlay}>
            <Ionicons name="play-circle" size={24} color="#0f0321" />
            <Text style={styles.playMeditationText}>Play Guided Meditation</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.meditationScriptBox}>
        <Text style={styles.meditationScriptLabel}>Guided Meditation Script</Text>
        <Text style={styles.meditationScript}>{meditation.script}</Text>
      </View>

      <View style={styles.meditationTip}>
        <Ionicons name="information-circle" size={18} color="#9f7aea" />
        <Text style={styles.meditationTipText}>
          Read through the script slowly, pausing at each [pause] instruction.
          You can also record yourself reading it.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  meditationSection: {
    marginTop: 24,
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  meditationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  meditationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  meditationInfo: { flex: 1 },
  meditationTitle: { fontSize: 18, fontWeight: 'bold', color: '#e9d5ff' },
  meditationDuration: { fontSize: 14, color: '#9f7aea', marginTop: 2 },
  meditationControls: { marginBottom: 16 },
  playMeditationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a855f7',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  playMeditationText: { color: '#0f0321', fontSize: 16, fontWeight: 'bold' },
  stopMeditationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  stopMeditationText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  progressText: { color: '#9f7aea', fontSize: 12, marginLeft: 8 },
  generatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  generatingText: { color: '#c4b5fd', fontSize: 14 },
  meditationScriptBox: {
    backgroundColor: '#0d0015',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  meditationScriptLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a855f7',
    marginBottom: 12,
  },
  meditationScript: { fontSize: 15, color: '#c4b5fd', lineHeight: 24 },
  meditationTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  meditationTipText: {
    flex: 1,
    fontSize: 13,
    color: '#9f7aea',
    lineHeight: 18,
  },
});
