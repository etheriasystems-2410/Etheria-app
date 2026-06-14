/**
 * Training screen — orchestrator for the psychic-mastery module list and
 * lesson player.
 *
 * Phase C refactor: state machinery moved out of this file into:
 *   - hooks/useTrainingProgress.ts        (completion tracking + backfill)
 *   - hooks/useTrainingMeditation.ts      (TTS playback)
 *   - components/training/*               (Hero, ModuleSection, ModuleCard,
 *                                          LessonListModal, LessonContentModal,
 *                                          MeditationPlayer)
 *
 * This file now owns module list fetching, modal visibility, and dispatch.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Paywall } from '../components/Paywall';
import { CosmicBackdrop } from '../components/ui';

import TrainingHero from '../components/training/TrainingHero';
import ModuleSection from '../components/training/ModuleSection';
import LessonListModal from '../components/training/LessonListModal';
import LessonContentModal from '../components/training/LessonContentModal';
import type { Lesson, Module } from '../components/training/types';

import { useTrainingProgress } from '../hooks/useTrainingProgress';
import { useTrainingMeditation } from '../hooks/useTrainingMeditation';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Training() {
  const { isPremium } = useAuth();
  const { t } = useLanguage();

  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  // Paywall on locked module tap
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

  // Lesson viewing state
  const [showLessons, setShowLessons] = useState(false);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);

  // Hooks: progress + meditation player
  const { isLessonCompleted, saveProgress } = useTrainingProgress(lessons);
  const {
    isPlayingMeditation,
    isGeneratingTTS,
    ttsProgress,
    playMeditation,
    stopMeditation,
  } = useTrainingMeditation();

  // Load module list once
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/training/modules`);
        setModules(await r.json());
      } catch (e) {
        console.error('Error loading training modules:', e);
      } finally {
        setLoading(false);
      }
    })();

    // Cleanup audio on unmount
    return () => {
      stopMeditation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleModulePress = async (module: Module) => {
    if (!module.free && !isPremium) {
      setSelectedModule(module);
      setShowPaywall(true);
      return;
    }
    setCurrentModule(module);
    setLoadingLessons(true);
    setShowLessons(true);
    try {
      const r = await fetch(
        `${BACKEND_URL}/api/training/modules/${module.id}/lessons`,
      );
      const data = await r.json();
      setLessons(data.lessons || []);
    } catch (e) {
      console.error('Error loading lessons:', e);
      setLessons([]);
    } finally {
      setLoadingLessons(false);
    }
  };

  const markLessonComplete = async () => {
    if (!currentModule || !currentLesson) return;
    const lessonKey = `${currentModule.id}-${currentLesson.id}`;
    const alreadyDone = isLessonCompleted(currentModule.id, currentLesson.id);

    if (!alreadyDone) {
      saveProgress(lessonKey);

      // Mirror into the user's journal so it shows up in the global history.
      try {
        const sessionToken = await AsyncStorage.getItem('session_token');
        const completionDate = new Date();
        const journalEntry = {
          title: `Training Complete: ${currentLesson.title}`,
          content: `Module: ${currentModule.title}\nLesson: ${currentLesson.title}\n\nCompleted on ${completionDate.toLocaleDateString()} at ${completionDate.toLocaleTimeString()}`,
          category: 'psychic',
          entry_type: 'training_completion',
          date: completionDate.toISOString(),
          metadata: {
            module_id: currentModule.id,
            module_title: currentModule.title,
            lesson_id: currentLesson.id,
            lesson_title: currentLesson.title,
            category: currentModule.category,
            completed_at: completionDate.toISOString(),
          },
        };
        await fetch(`${BACKEND_URL}/api/journal/entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: sessionToken ? `Bearer ${sessionToken}` : '',
          },
          body: JSON.stringify(journalEntry),
        });
      } catch (e) {
        console.error('Error saving training completion to journal:', e);
      }
    }

    // Advance to next lesson, or close if last.
    const currentIndex = lessons.findIndex((l) => l.id === currentLesson.id);
    if (currentIndex < lessons.length - 1) {
      setCurrentLesson(lessons[currentIndex + 1]);
    } else {
      setCurrentLesson(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>{t('loadingModules')}</Text>
      </View>
    );
  }

  const beginnerModules = modules.filter((m) => m.category === 'beginner');
  const intermediateModules = modules.filter((m) => m.category === 'intermediate');
  const advancedModules = modules.filter((m) => m.category === 'advanced');

  return (
    <View style={styles.container}>
      <CosmicBackdrop />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TrainingHero
          title={t('psychicTraining')}
          subtitle={t('developAbilities')}
        />

        <View style={styles.content}>
          <ModuleSection
            title={t('beginner')}
            icon="leaf"
            color="#10b981"
            modules={beginnerModules}
            isPremium={isPremium}
            onModulePress={handleModulePress}
          />
          <ModuleSection
            title={t('intermediate')}
            icon="flame"
            color="#f59e0b"
            modules={intermediateModules}
            isPremium={isPremium}
            onModulePress={handleModulePress}
          />
          <ModuleSection
            title={t('advanced')}
            icon="star"
            color="#ef4444"
            modules={advancedModules}
            isPremium={isPremium}
            onModulePress={handleModulePress}
          />

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <LessonListModal
        visible={showLessons && !currentLesson}
        onClose={() => setShowLessons(false)}
        module={currentModule}
        lessons={lessons}
        loadingLessons={loadingLessons}
        isLessonCompleted={isLessonCompleted}
        onLessonPress={(lesson) => setCurrentLesson(lesson)}
      />

      <LessonContentModal
        visible={!!currentLesson}
        onClose={() => setCurrentLesson(null)}
        lesson={currentLesson}
        lessons={lessons}
        onComplete={markLessonComplete}
        isPlayingMeditation={isPlayingMeditation}
        isGeneratingTTS={isGeneratingTTS}
        ttsProgress={ttsProgress}
        onPlayMeditation={() => playMeditation(currentLesson)}
        onStopMeditation={stopMeditation}
      />

      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature={selectedModule?.title || 'Premium Training'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0015' },
  scrollContent: { flexGrow: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d0015',
  },
  loadingText: { color: '#c4b5fd', marginTop: 16, fontSize: 16 },
  content: { padding: 16 },
});
