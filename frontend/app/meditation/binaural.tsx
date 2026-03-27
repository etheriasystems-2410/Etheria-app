import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface BinauralProgram {
  id: string;
  name: string;
  frequency: string;
  benefit: string;
  icon: string;
  color: string;
}

const programs: BinauralProgram[] = [
  {
    id: 'delta',
    name: 'Deep Sleep (Delta)',
    frequency: '0.5 - 4 Hz',
    benefit: 'Promotes deep sleep and healing',
    icon: 'moon',
    color: '#4c1d95',
  },
  {
    id: 'theta',
    name: 'Meditation (Theta)',
    frequency: '4 - 8 Hz',
    benefit: 'Enhances meditation and creativity',
    icon: 'eye',
    color: '#7c3aed',
  },
  {
    id: 'alpha',
    name: 'Relaxation (Alpha)',
    frequency: '8 - 13 Hz',
    benefit: 'Reduces stress and anxiety',
    icon: 'leaf',
    color: '#a855f7',
  },
  {
    id: 'beta',
    name: 'Focus (Beta)',
    frequency: '13 - 30 Hz',
    benefit: 'Improves concentration and alertness',
    icon: 'flash',
    color: '#c084fc',
  },
];

export default function BinauralMeditation() {
  const router = useRouter();
  const [selectedProgram, setSelectedProgram] = useState<BinauralProgram | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Binaural Meditation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="headset" size={40} color="#b794f6" />
          <Text style={styles.infoTitle}>What is Binaural Meditation?</Text>
          <Text style={styles.infoText}>
            Binaural beats synchronize your brainwaves to specific frequencies, enhancing
            meditation, relaxation, and mental clarity. Use headphones for best results.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Choose a Program</Text>

        {programs.map((program) => (
          <TouchableOpacity
            key={program.id}
            style={[
              styles.programCard,
              selectedProgram?.id === program.id && styles.programCardActive,
            ]}
            onPress={() => setSelectedProgram(program)}
            activeOpacity={0.7}
          >
            <View style={[styles.programIcon, { backgroundColor: program.color }]}>
              <Ionicons name={program.icon as any} size={32} color="#fff" />
            </View>
            <View style={styles.programInfo}>
              <Text style={styles.programName}>{program.name}</Text>
              <Text style={styles.programFrequency}>{program.frequency}</Text>
              <Text style={styles.programBenefit}>{program.benefit}</Text>
            </View>
            {selectedProgram?.id === program.id && (
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            )}
          </TouchableOpacity>
        ))}

        {selectedProgram && (
          <View style={styles.playerSection}>
            <View
              style={[
                styles.visualizer,
                { backgroundColor: selectedProgram.color + '20' },
              ]}
            >
              <View style={styles.waveform}>
                {[...Array(20)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.wavebar,
                      {
                        height: isPlaying ? Math.random() * 60 + 20 : 20,
                        backgroundColor: selectedProgram.color,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.playButton,
                { backgroundColor: selectedProgram.color },
              ]}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={40}
                color="#fff"
              />
            </TouchableOpacity>

            <Text style={styles.instruction}>
              {isPlaying
                ? 'Find a comfortable position and focus on your breath...'
                : 'Tap to begin your binaural meditation session'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a0033',
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
  },
  content: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e9d5ff',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 16,
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2d1b4e',
  },
  programCardActive: {
    borderColor: '#7c3aed',
  },
  programIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  programInfo: {
    flex: 1,
  },
  programName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 4,
  },
  programFrequency: {
    fontSize: 14,
    color: '#b794f6',
    marginBottom: 4,
  },
  programBenefit: {
    fontSize: 13,
    color: '#c4b5fd',
  },
  playerSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  visualizer: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: 16,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
  },
  wavebar: {
    width: 4,
    borderRadius: 2,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    color: '#c4b5fd',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
