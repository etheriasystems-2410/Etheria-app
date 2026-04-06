import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Paywall } from '../../components/Paywall';

interface AstralLevel {
  id: string;
  name: string;
  description: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const levels: AstralLevel[] = [
  {
    id: 'intro',
    name: 'Introduction to Astral Travel',
    description: 'Learn the basics of out-of-body experiences',
    duration: 15,
    difficulty: 'beginner',
  },
  {
    id: 'body-scan',
    name: 'Deep Body Relaxation',
    description: 'Master the vibrational state',
    duration: 20,
    difficulty: 'beginner',
  },
  {
    id: 'separation',
    name: 'Consciousness Separation',
    description: 'Practice leaving your physical form',
    duration: 25,
    difficulty: 'intermediate',
  },
  {
    id: 'navigation',
    name: 'Astral Navigation',
    description: 'Explore the astral realm with control',
    duration: 30,
    difficulty: 'advanced',
  },
];

export default function AstralTravel() {
  const router = useRouter();
  const { isPremium } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<AstralLevel | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Check premium access on mount
  React.useEffect(() => {
    if (!isPremium) {
      setShowPaywall(true);
    }
  }, [isPremium]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '#10b981';
      case 'intermediate':
        return '#f59e0b';
      case 'advanced':
        return '#ef4444';
      default:
        return '#8b5cf6';
    }
  };

  const startSession = () => {
    if (selectedLevel) {
      setSessionActive(true);
    }
  };

  if (sessionActive && selectedLevel) {
    return (
      <View style={styles.container}>
        <View style={styles.sessionContainer}>
          <View style={styles.cosmicBackground}>
            <View style={styles.orb1} />
            <View style={styles.orb2} />
            <View style={styles.orb3} />
          </View>

          <View style={styles.sessionContent}>
            <Text style={styles.sessionTitle}>{selectedLevel.name}</Text>
            <Text style={styles.sessionInstruction}>
              Close your eyes, relax your body completely, and follow the guidance...
            </Text>

            <View style={styles.breathingCircle}>
              <View style={styles.breathingInner}>
                <Text style={styles.breathingText}>Breathe</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.endButton}
              onPress={() => setSessionActive(false)}
            >
              <Text style={styles.endButtonText}>End Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ImageBackground 
      source={require('../../assets/backgrounds/astral-bg.jpg')}
      style={styles.container}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.backgroundOverlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#e9d5ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Astral Travel Practice</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={32} color="#f59e0b" />
          <Text style={styles.warningTitle}>Important Guidelines</Text>
          <Text style={styles.warningText}>
            {`• Practice in a safe, comfortable space\n• Never attempt while driving or operating machinery\n• Start with beginner levels\n• Set a clear intention to return to your body`}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Choose Your Level</Text>

        {levels.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.levelCard,
              selectedLevel?.id === level.id && styles.levelCardActive,
            ]}
            onPress={() => setSelectedLevel(level)}
            activeOpacity={0.7}
          >
            <View style={styles.levelHeader}>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(level.difficulty) },
                ]}
              >
                <Text style={styles.difficultyText}>
                  {level.difficulty.toUpperCase()}
                </Text>
              </View>
              <View style={styles.durationBadge}>
                <Ionicons name="time" size={16} color="#c4b5fd" />
                <Text style={styles.durationText}>{level.duration} min</Text>
              </View>
            </View>
            <Text style={styles.levelName}>{level.name}</Text>
            <Text style={styles.levelDescription}>{level.description}</Text>
            {selectedLevel?.id === level.id && (
              <View style={styles.selectedIndicator}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={styles.selectedText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {selectedLevel && (
          <TouchableOpacity style={styles.startButton} onPress={startSession}>
            <Ionicons name="planet" size={24} color="#fff" />
            <Text style={styles.startButtonText}>Begin Astral Journey</Text>
          </TouchableOpacity>
        )}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Tips for Success</Text>
          <Text style={styles.tipText}>✨ Practice regularly at the same time</Text>
          <Text style={styles.tipText}>✨ Keep a journal of your experiences</Text>
          <Text style={styles.tipText}>✨ Stay patient - mastery takes time</Text>
          <Text style={styles.tipText}>✨ Trust your intuition and inner guidance</Text>
        </View>
      </ScrollView>

      <Paywall
        visible={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          if (!isPremium) {
            router.back();
          }
        }}
        feature="Astral Travel Practice"
      />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
  },
  backgroundImage: {
    opacity: 0.25,
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 3, 33, 0.75)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(26, 0, 51, 0.8)',
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
    padding: 12,
  },
  warningCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f59e0b',
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 16,
  },
  levelCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2d1b4e',
  },
  levelCardActive: {
    borderColor: '#7c3aed',
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 14,
    color: '#c4b5fd',
  },
  levelName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 8,
  },
  levelDescription: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 20,
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  selectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 25,
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  tipsCard: {
    backgroundColor: '#1a0033',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e9d5ff',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#c4b5fd',
    lineHeight: 24,
  },
  sessionContainer: {
    flex: 1,
    position: 'relative',
  },
  cosmicBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0015',
  },
  orb1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#7c3aed',
    opacity: 0.1,
    top: 100,
    left: -50,
  },
  orb2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#a855f7',
    opacity: 0.15,
    bottom: 150,
    right: -30,
  },
  orb3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#c084fc',
    opacity: 0.2,
    top: '50%',
    right: 50,
  },
  sessionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e9d5ff',
    textAlign: 'center',
    marginBottom: 16,
  },
  sessionInstruction: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    marginBottom: 60,
    lineHeight: 24,
  },
  breathingCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#7c3aed',
    opacity: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  breathingInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  endButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#2d1b4e',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e9d5ff',
  },
});
