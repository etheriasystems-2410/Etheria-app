import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface MeditationFocus {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const focuses: MeditationFocus[] = [
  {
    id: 'stress-relief',
    name: 'Stress Relief',
    description: 'Release tension and find calm',
    icon: 'heart',
  },
  {
    id: 'sleep',
    name: 'Better Sleep',
    description: 'Prepare your mind for rest',
    icon: 'moon',
  },
  {
    id: 'focus',
    name: 'Focus & Clarity',
    description: 'Sharpen your mental clarity',
    icon: 'eye',
  },
  {
    id: 'spiritual',
    name: 'Spiritual Growth',
    description: 'Deepen your spiritual practice',
    icon: 'sparkles',
  },
];

export default function AIGuidedMeditation() {
  const router = useRouter();
  const [selectedFocus, setSelectedFocus] = useState<string>('stress-relief');
  const [duration, setDuration] = useState(10);
  const [script, setScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateMeditation = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/meditation/generate-guided?duration_minutes=${duration}&focus=${selectedFocus}`,
        { method: 'POST' }
      );
      const data = await response.json();
      setScript(data.script);
    } catch (error) {
      console.error('Error generating meditation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (script) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScript(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Meditation</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scriptContainer} contentContainerStyle={styles.scriptContent}>
          <Text style={styles.scriptText}>{script}</Text>
        </ScrollView>

        <View style={styles.scriptControls}>
          <TouchableOpacity style={styles.playButton}>
            <Ionicons name="play" size={32} color="#fff" />
            <Text style={styles.playButtonText}>Begin Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Guided Meditation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus Area</Text>
          <View style={styles.focusGrid}>
            {focuses.map((focus) => (
              <TouchableOpacity
                key={focus.id}
                style={[
                  styles.focusCard,
                  selectedFocus === focus.id && styles.focusCardActive,
                ]}
                onPress={() => setSelectedFocus(focus.id)}
              >
                <Ionicons
                  name={focus.icon as any}
                  size={32}
                  color={selectedFocus === focus.id ? '#fff' : '#c4b5fd'}
                />
                <Text
                  style={[
                    styles.focusName,
                    selectedFocus === focus.id && styles.focusNameActive,
                  ]}
                >
                  {focus.name}
                </Text>
                <Text
                  style={[
                    styles.focusDescription,
                    selectedFocus === focus.id && styles.focusDescriptionActive,
                  ]}
                >
                  {focus.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration: {duration} minutes</Text>
          <View style={styles.durationSlider}>
            {[5, 10, 15, 20].map((min) => (
              <TouchableOpacity
                key={min}
                style={[
                  styles.durationButton,
                  duration === min && styles.durationButtonActive,
                ]}
                onPress={() => setDuration(min)}
              >
                <Text
                  style={[
                    styles.durationText,
                    duration === min && styles.durationTextActive,
                  ]}
                >
                  {min}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
          onPress={generateMeditation}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.generateButtonText}>Generating...</Text>
            </>
          ) : (
            <>
              <Ionicons name="create" size={24} color="#fff" />
              <Text style={styles.generateButtonText}>Generate Meditation</Text>
            </>
          )}
        </TouchableOpacity>
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 16,
  },
  focusGrid: {
    gap: 12,
  },
  focusCard: {
    backgroundColor: '#2d1b4e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2d1b4e',
  },
  focusCardActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  focusName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#c4b5fd',
    marginTop: 12,
  },
  focusNameActive: {
    color: '#fff',
  },
  focusDescription: {
    fontSize: 14,
    color: '#9f7aea',
    marginTop: 4,
    textAlign: 'center',
  },
  focusDescriptionActive: {
    color: '#e9d5ff',
  },
  durationSlider: {
    flexDirection: 'row',
    gap: 12,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2d1b4e',
    borderWidth: 2,
    borderColor: '#2d1b4e',
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c4b5fd',
  },
  durationTextActive: {
    color: '#fff',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 25,
    gap: 12,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scriptContainer: {
    flex: 1,
  },
  scriptContent: {
    padding: 20,
  },
  scriptText: {
    fontSize: 16,
    lineHeight: 28,
    color: '#e9d5ff',
  },
  scriptControls: {
    padding: 20,
    backgroundColor: '#1a0033',
    borderTopWidth: 1,
    borderTopColor: '#2d1b4e',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 25,
    gap: 12,
  },
  playButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
