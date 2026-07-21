import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { Paywall } from '../components/Paywall';
import { CosmicBackdrop } from '../components/ui';
import LessonWorkbook from '../components/training/LessonWorkbook';
import LessonHeroBanner from '../components/training/LessonHeroBanner';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const ASTRAL_HERO_IMAGE = 'https://customer-assets.emergentagent.com/job_meditation-nexus/artifacts/36730.jpg';

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
  const [completedLevels, setCompletedLevels] = useState<string[]>([]);
  const [workbookLevel, setWorkbookLevel] = useState<AstralLevel | null>(null);

  // Load completed levels from storage
  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const progress = await AsyncStorage.getItem('completed_astral_levels');
      if (progress) {
        setCompletedLevels(JSON.parse(progress));
      }
    } catch (error) {
      console.error('Error loading astral progress:', error);
    }
  };

  const saveProgress = async (levelId: string) => {
    try {
      const newCompleted = [...completedLevels, levelId];
      setCompletedLevels(newCompleted);
      await AsyncStorage.setItem('completed_astral_levels', JSON.stringify(newCompleted));
    } catch (error) {
      console.error('Error saving astral progress:', error);
    }
  };

  const saveToJournal = async (level: AstralLevel) => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const completionDate = new Date();
      
      const journalEntry = {
        title: `Astral Training Complete: ${level.name}`,
        content: `Level: ${level.name}\nDifficulty: ${level.difficulty}\nDuration: ${level.duration} minutes\n\n${level.description}\n\nCompleted on ${completionDate.toLocaleDateString()} at ${completionDate.toLocaleTimeString()}`,
        category: 'psychic',
        entry_type: 'training_completion',
        date: completionDate.toISOString(),
        metadata: {
          module_id: 'astral-training',
          module_title: 'Astral Travel Self-Study',
          lesson_id: level.id,
          lesson_title: level.name,
          category: 'astral',
          difficulty: level.difficulty,
          duration: level.duration,
          completed_at: completionDate.toISOString(),
        },
      };

      await fetch(`${BACKEND_URL}/api/journal/entries`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
        },
        body: JSON.stringify(journalEntry),
      });
    } catch (error) {
      console.error('Error saving astral training to journal:', error);
    }
  };

  const completeSession = async () => {
    if (selectedLevel && !completedLevels.includes(selectedLevel.id)) {
      await saveProgress(selectedLevel.id);
      await saveToJournal(selectedLevel);
    }
    setSessionActive(false);
  };

  const isLevelCompleted = (levelId: string) => {
    return completedLevels.includes(levelId);
  };

  // Check premium access on mount
  useEffect(() => {
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
        <CosmicBackdrop />
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
              onPress={completeSession}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.endButtonText}>Complete Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 24 }} />
        <Text style={styles.headerTitle}>Astral Travel Self-Study</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Section with Image Background */}
        <View style={styles.heroSection}>
          <Image
            source={{ uri: ASTRAL_HERO_IMAGE }}
            style={styles.heroImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(13,0,21,0)', 'rgba(13,0,21,0.55)', 'rgba(13,0,21,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroEyebrow}>✦ Beyond the Veil ✦</Text>
            <Text style={styles.heroTitle}>Astral Travel</Text>
            <View style={styles.heroGlyphRow}>
              <View style={styles.heroGlyphLine} />
              <Ionicons name="sparkles" size={11} color="#fbbf24" style={{ marginHorizontal: 8 }} />
              <View style={styles.heroGlyphLine} />
            </View>
            <Text style={styles.heroSubtitle}>Journey beyond the physical</Text>
          </View>
        </View>

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
              isLevelCompleted(level.id) && styles.levelCardCompleted,
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
              {isLevelCompleted(level.id) && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  <Text style={styles.completedText}>Done</Text>
                </View>
              )}
            </View>
            <Text style={styles.levelName}>{level.name}</Text>
            <Text style={styles.levelDescription}>{level.description}</Text>
            <TouchableOpacity
              style={styles.workbookLink}
              onPress={(e) => {
                e.stopPropagation?.();
                setWorkbookLevel(level);
              }}
            >
              <Ionicons name="book-outline" size={14} color="#fbbf24" />
              <Text style={styles.workbookLinkText}>Open Workbook</Text>
            </TouchableOpacity>
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

      {/* Astral workbook modal — notes / practice log / quiz per level */}
      <Modal
        visible={!!workbookLevel}
        animationType="slide"
        onRequestClose={() => setWorkbookLevel(null)}
      >
        <View style={styles.workbookModal}>
          <View style={styles.workbookHeader}>
            <TouchableOpacity
              onPress={() => setWorkbookLevel(null)}
              style={styles.workbookHeaderBtn}
            >
              <Ionicons name="arrow-back" size={22} color="#e9d5ff" />
            </TouchableOpacity>
            <Text style={styles.workbookHeaderTitle} numberOfLines={1}>
              {workbookLevel?.name || 'Workbook'}
            </Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView contentContainerStyle={styles.workbookScroll}>
            <Text style={styles.workbookHint}>
              {workbookLevel?.description}
            </Text>
            {workbookLevel ? (
              <LessonWorkbook
                moduleId="astral-training"
                lessonId={workbookLevel.id}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0015',
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
  heroSection: {
    height: 180,
    position: 'relative',
    marginHorizontal: -12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#fbbf24',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(168,85,247,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  heroGlyphRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  heroGlyphLine: { width: 32, height: 1, backgroundColor: 'rgba(251,191,36,0.6)' },
  heroSubtitle: {
    fontSize: 12,
    color: '#e9d5ff',
    textAlign: 'center',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
  levelCardCompleted: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
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
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
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
  workbookLink: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
  },
  workbookLinkText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  workbookModal: {
    flex: 1,
    backgroundColor: '#0d0015',
  },
  workbookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d1b4e',
    backgroundColor: '#1a0033',
  },
  workbookHeaderBtn: { padding: 4 },
  workbookHeaderTitle: {
    color: '#e9d5ff',
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  workbookScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  workbookHint: {
    color: '#c4b5fd',
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    marginBottom: 4,
  },
});
